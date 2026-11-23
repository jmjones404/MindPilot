import { test, expect, type Page } from '@playwright/test';
test.beforeEach(async ({ page }) => { await page.clock.install({ time: new Date('2026-11-23T12:00:00-05:00') }); });
const example = 'Yo, I gotta study, send this email, catch some fish, and clean the inside of my car.';
async function organize(page: Page, text: string) {
  await page.goto('./#minddump');
  await page.getByRole('textbox', { name: 'What’s on your mind?', exact: true }).fill(text);
  await page.getByRole('button', { name: /Find my next steps|Review updated thoughts/ }).click();
  await expect(page.getByRole('region', { name: 'Review suggestions' })).toBeFocused();
}
async function nav(page: Page, name: string) { await page.getByRole('navigation', { name: 'Mobile navigation' }).getByRole('button', { name, exact: true }).click(); }
async function records(page: Page) {
  return page.evaluate(async () => {
    const request = indexedDB.open('mindpilot-local-v1');
    const db = await new Promise<IDBDatabase>((resolve, reject) => { request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
    const get = db.transaction('app').objectStore('app').get('data');
    return new Promise<{ tasks: { title: string; category: string; kind: string }[]; memories: unknown[] }>(resolve => { get.onsuccess = () => { resolve(get.result ?? { tasks: [], memories: [] }); db.close(); }; });
  });
}

test('four editable items, selective approval, category views, completion and offline refresh', async ({ page, context }) => {
  await organize(page, example);
  const cards = page.locator('.review-card');
  await expect(cards).toHaveCount(4);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/organizer-mobile.png' });
  for (const [i, category] of ['Education', 'Communication', 'Recreation', 'Personal'].entries()) await expect(cards.nth(i).getByRole('combobox', { name: 'Category', exact: true })).toHaveValue(category);
  await expect(cards.nth(3).getByRole('combobox', { name: 'Subcategory optional', exact: true })).toHaveValue('Vehicle Maintenance');
  expect((await records(page)).tasks).toHaveLength(0);
  await cards.nth(1).getByRole('checkbox').first().uncheck();
  await cards.nth(0).getByLabel('Activity name', { exact: true }).fill('Study Spanish');
  await page.getByRole('button', { name: 'Confirm 3 activities' }).click();
  await expect(page.getByRole('heading', { name: 'A little less on your mind.' })).toBeVisible();
  await page.getByRole('button', { name: 'Open planner', exact: true }).click();
  await expect(page.getByText('Study Spanish', { exact: true })).toBeVisible();
  await page.getByRole('combobox', { name: 'Filter by category', exact: true }).selectOption('Personal');
  await expect(page.getByText('Clean the inside of my car', { exact: true })).toBeVisible();
  await expect(page.getByText('Study Spanish', { exact: true })).toHaveCount(0);
  await page.getByRole('checkbox', { name: 'Complete Clean the inside of my car' }).click();
  await expect(page.getByRole('checkbox', { name: 'Complete Clean the inside of my car' })).toBeChecked();
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => true));
  await context.setOffline(true); await page.reload();
  await expect(page.getByRole('checkbox', { name: 'Complete Clean the inside of my car' })).toBeChecked();
  await page.getByRole('checkbox', { name: 'Complete Clean the inside of my car' }).click();
  expect((await records(page)).tasks).toHaveLength(3);
  await nav(page, 'MindDump');
  await page.getByRole('textbox', { name: 'What’s on your mind?', exact: true }).fill('Pay rent on December 1 at 9 am.');
  await page.getByRole('button', { name: 'Find my next steps' }).click();
  await expect(page.locator('.review-card').getByLabel('Date', { exact: true })).toHaveValue('2026-12-01');
  await expect(page.locator('.review-card').getByLabel('Start time', { exact: true })).toHaveValue('09:00');
  await page.getByRole('button', { name: 'Confirm 1 activity' }).click();
  await page.getByRole('button', { name: 'Open planner', exact: true }).click();
  await expect(page.getByText('Pay rent', { exact: true })).toBeVisible();
});

test('category corrections require consent, remain scoped and can be edited and removed', async ({ page }) => {
  await organize(page, 'Send family email');
  await page.getByRole('combobox', { name: 'Category', exact: true }).selectOption('Relationships');
  await expect(page.getByRole('checkbox', { name: /Remember this category/ })).not.toBeChecked();
  await page.getByRole('checkbox', { name: /Remember this category/ }).check();
  await page.getByRole('button', { name: 'Confirm 1 activity' }).click();
  expect((await records(page)).memories).toHaveLength(1);
  await page.getByRole('button', { name: 'Capture another thought' }).click();
  await page.getByRole('textbox', { name: 'What’s on your mind?', exact: true }).fill('Send family emails');
  await page.getByRole('button', { name: 'Find my next steps' }).click();
  await expect(page.getByRole('combobox', { name: 'Category', exact: true })).toHaveValue('Relationships');
  await nav(page, 'My Rhythm');
  await page.getByRole('button', { name: 'Preferences 1', exact: true }).click();
  await page.getByRole('button', { name: 'Edit Category for Send family email', exact: true }).click();
  await page.getByRole('dialog').getByRole('combobox', { name: 'Apply this preference to', exact: true }).selectOption('exact');
  await page.getByRole('button', { name: 'Save memory', exact: true }).click();
  await page.getByRole('button', { name: 'Edit Category for Send family email', exact: true }).click();
  await expect(page.getByRole('dialog').getByRole('combobox', { name: 'Apply this preference to', exact: true })).toHaveValue('exact');
  await page.getByRole('button', { name: 'Delete memory', exact: true }).click();
  await page.getByRole('button', { name: 'Delete memory', exact: true }).last().click();
  expect((await records(page)).memories).toHaveLength(0);
  await nav(page, 'MindDump');
  await page.getByRole('textbox', { name: 'What’s on your mind?', exact: true }).fill('Send family email');
  await page.getByRole('button', { name: 'Review updated thoughts' }).click();
  await expect(page.getByRole('combobox', { name: 'Category', exact: true })).toHaveValue('Communication');
  await page.getByRole('combobox', { name: 'Category', exact: true }).selectOption('Relationships');
  await page.getByRole('button', { name: 'Confirm 1 activity' }).click();
  expect((await records(page)).memories).toHaveLength(0);
});

test('changed input cannot save old suggestions and ambiguous dates never become today', async ({ page }) => {
  await organize(page, 'Call Alex tomorrow');
  await page.getByRole('textbox', { name: 'What’s on your mind?', exact: true }).fill('Call Alex on February 30 at 6 pm');
  await expect(page.getByRole('button', { name: 'Confirm 1 activity' })).toBeDisabled();
  await page.getByRole('button', { name: 'Review updated thoughts' }).click();
  await expect(page.getByLabel('Date', { exact: true })).toHaveValue('');
  await page.getByRole('button', { name: 'Confirm 1 activity' }).click();
  await expect(page.getByRole('alert')).toContainText('Choose a date');
  expect((await records(page)).tasks).toHaveLength(0);
  await page.getByLabel('Date', { exact: true }).fill('2026-12-01');
  await page.getByRole('button', { name: 'Confirm 1 activity' }).evaluate(button => { (button as HTMLButtonElement).click(); (button as HTMLButtonElement).click(); });
  await expect(page.getByRole('heading', { name: 'A little less on your mind.' })).toBeVisible();
  expect((await records(page)).tasks).toHaveLength(1);
});

test('workouts without preferences are saveable and optional notes do not enter progress', async ({ page }) => {
  await organize(page, "I'm stressed. Need the gym tonight.");
  await expect(page.locator('.review-card')).toHaveCount(2);
  await expect(page.getByRole('button', { name: 'Confirm 1 activity' })).toBeEnabled();
  await page.getByRole('button', { name: 'Confirm 1 activity' }).click();
  expect((await records(page)).tasks).toHaveLength(1);
  await page.getByRole('button', { name: 'Capture another thought' }).click();
  await page.getByRole('textbox', { name: 'What’s on your mind?', exact: true }).fill('Note: the spare key is in the drawer.');
  await page.getByRole('button', { name: 'Find my next steps' }).click();
  await page.getByRole('button', { name: 'Confirm 1 activity' }).click();
  await page.getByRole('button', { name: 'Open planner', exact: true }).click();
  await expect(page.getByRole('button', { name: /Open note The spare key/ })).toBeVisible();
  await expect(page.getByRole('checkbox', { name: /Complete The spare key/ })).toHaveCount(0);
});

test('worker failure uses the same offline rules and input stays editable', async ({ page }) => {
  await page.addInitScript(() => { window.Worker = class { constructor() { throw new Error('Workers blocked for test'); } } as unknown as typeof Worker; });
  await organize(page, example);
  await expect(page.locator('.review-card')).toHaveCount(4);
  await expect(page.getByText('Using compatibility mode', { exact: false })).toBeVisible();
});

test('legacy records and custom settings survive migration and a new save', async ({ page }) => {
  await page.goto('./');
  await page.evaluate(async () => {
    const req=indexedDB.open('mindpilot-local-v1');
    const db=await new Promise<IDBDatabase>(resolve=>{req.onsuccess=()=>resolve(req.result);});
    const tx=db.transaction('app','readwrite');
    tx.objectStore('app').put({ version:1, tasks:[{id:'legacy-keep',title:'Original task',category:'My errands',date:'',time:'',duration:30,notes:'Keep these notes',priority:false,createdAt:'2026-11-01T12:00:00Z',completedAt:null}], routines:[],memories:[{id:'legacy-pref',kind:'preference',title:'Original preference',detail:'Keep this text'}],routineLogs:[],settings:{name:'Test',theme:'dark',categories:['My errands']} },'data');
    await new Promise<void>((resolve,reject)=>{tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);});db.close();
  });
  await page.reload();await nav(page,'Planner');
  await expect(page.getByText('Original task',{exact:true})).toBeVisible();
  await expect(page.locator('html')).toHaveClass('dark');
  await nav(page,'MindDump');
  await page.getByRole('textbox',{name:'What’s on your mind?',exact:true}).fill('Buy apples');
  await page.getByRole('button',{name:'Find my next steps'}).click();
  await page.getByRole('button',{name:'Confirm 1 activity'}).click();
  await expect(page.getByRole('heading',{name:'A little less on your mind.'})).toBeVisible();
  const saved=await records(page);
  expect(saved.tasks).toHaveLength(2);expect(saved.tasks[0]).toMatchObject({id:'legacy-keep',title:'Original task',notes:'Keep these notes'});
  expect(saved.memories).toEqual([{id:'legacy-pref',kind:'preference',title:'Original preference',detail:'Keep this text'}]);
});

test('new approvals immediately update another open planner tab', async ({page,context})=>{
  await page.goto('./#planner');
  const second=await context.newPage();
  await organize(second,'Study biology');
  await second.getByRole('button',{name:'Confirm 1 activity'}).click();
  await expect(page.getByText('Study biology',{exact:true})).toBeVisible();
  await second.close();
});

test('a newer home capture wins when an earlier organizing request finishes late', async ({ page }) => {
  await page.addInitScript(() => {
    const NativeWorker = window.Worker;
    const control = window as unknown as { releaseFirst?: () => void; firstResponded?: boolean };
    window.Worker = class extends NativeWorker {
      postMessage(message: { id?: number }) {
        if (message.id === 1) {
          control.releaseFirst = () => super.postMessage(message);
          this.addEventListener('message', event => {
            if (event.data.id === 1) control.firstResponded = true;
          });
        } else super.postMessage(message);
      }
    };
  });
  await page.goto('./');
  await page.getByRole('textbox', { name: "What's on your mind?", exact: true }).fill('Call Alex');
  await page.getByRole('button', { name: 'Organize my thoughts', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Organizing…', exact: true })).toBeVisible();
  await expect.poll(() => page.evaluate(() => typeof (window as unknown as { releaseFirst?: () => void }).releaseFirst)).toBe('function');
  await nav(page, 'Home');
  await page.getByRole('textbox', { name: "What's on your mind?", exact: true }).fill('Study botany');
  await page.getByRole('button', { name: 'Organize my thoughts', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'Activity name', exact: true })).toHaveValue('Study botany');
  await page.evaluate(() => (window as unknown as { releaseFirst: () => void }).releaseFirst());
  await expect.poll(() => page.evaluate(() => (window as unknown as { firstResponded?: boolean }).firstResponded)).toBe(true);
  await expect(page.getByRole('textbox', { name: 'Activity name', exact: true })).toHaveValue('Study botany');
  await page.getByRole('button', { name: 'Confirm 1 activity' }).click();
  await expect(page.getByRole('heading', { name: 'A little less on your mind.' })).toBeVisible();
  expect((await records(page)).tasks.map(task => task.title)).toEqual(['Study botany']);
});

test('a long list stays complete and usable on a narrow mobile screen', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 });
  const activities = Array.from({ length: 16 }, (_, i) => `Review chapter ${i + 1}`);
  await organize(page, activities.join('\n'));
  await expect(page.locator('.review-card')).toHaveCount(16);
  await expect(page.getByRole('button', { name: 'Confirm 16 activities' })).toBeEnabled();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await expect(page.getByRole('textbox', { name: 'Activity name', exact: true }).last()).toHaveValue('Review chapter 16');
});
