import {test,expect,type Page} from '@playwright/test';
test.beforeEach(async({page})=>{await page.clock.install({time:new Date('2026-11-25T07:00:00-05:00')});});
async function organize(page:Page,text:string){await page.goto('./#minddump');await page.getByRole('textbox',{name:'What’s on your mind?',exact:true}).fill(text);await page.getByRole('button',{name:'Find my next steps'}).click();await expect(page.getByRole('region',{name:'Review suggestions'})).toBeFocused();}
async function saved(page:Page){return page.evaluate(async()=>{const req=indexedDB.open('mindpilot-local-v1');const db=await new Promise<IDBDatabase>(r=>{req.onsuccess=()=>r(req.result);});const get=db.transaction('app').objectStore('app').get('data');return new Promise<any>(r=>{get.onsuccess=()=>{r(get.result??{tasks:[],routines:[]});db.close();};});});}
test('ambiguous time is resolved before approval and weekday titles stay clean',async({page})=>{
 await organize(page,'Meeting with professor Thursday. Study Evidence tomorrow at 3');
 const cards=page.locator('.review-card');await expect(cards).toHaveCount(2);
 await expect(cards.nth(0).getByLabel('Activity name',{exact:true})).toHaveValue('Meeting with professor');
 await expect(cards.nth(0).getByLabel('Date',{exact:true})).toHaveValue('2026-11-26');
 await page.getByRole('button',{name:'Confirm 2 activities'}).click();await expect(page.getByRole('alert')).toContainText('ambiguous time');
 await page.getByRole('combobox',{name:'Confirm time',exact:true}).selectOption('15:00');
 await page.getByRole('button',{name:'Confirm 2 activities'}).click();await expect(page.getByRole('heading',{name:'A little less on your mind.'})).toBeVisible();
 expect((await saved(page)).tasks[1]).toMatchObject({title:'Study Evidence',date:'2026-11-26',time:'15:00'});
});
test('checklist edits and individual checks persist after offline refresh',async({page,context})=>{
 await organize(page,'Need to get groceries, milk, eggs, bread and steak');
 await expect(page.getByLabel('Item 1',{exact:true})).toHaveValue('milk');
 await page.getByLabel('Item 2',{exact:true}).fill('a dozen eggs');await page.getByRole('checkbox',{name:'Check milk',exact:true}).check();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.getByRole('button',{name:'Confirm 1 activity'}).click();await page.getByRole('button',{name:'Open planner',exact:true}).click();
 await page.getByRole('button',{name:'Edit Get groceries',exact:true}).click();
 await page.getByRole('dialog').getByRole('checkbox',{name:'Check bread',exact:true}).check();await page.getByRole('button',{name:'Save changes',exact:true}).click();
 await expect(page.getByRole('dialog')).toHaveCount(0);
 await expect(page.getByRole('status')).toContainText('Activity updated.');
 await page.evaluate(()=>navigator.serviceWorker.ready.then(()=>true));await context.setOffline(true);await page.reload();
 await page.getByRole('button',{name:'Edit Get groceries',exact:true}).click();await expect(page.getByRole('dialog').getByRole('checkbox',{name:'Check bread',exact:true})).toBeChecked();
 expect((await saved(page)).tasks[0].checklist).toEqual([{text:'milk',done:true},{text:'a dozen eggs',done:false},{text:'bread',done:true},{text:'steak',done:false}]);
});
test('recurring recommendation is editable and saves a routine only with consent',async({page})=>{
 await organize(page,'10 minute morning meditation every day');
 await expect(page.getByLabel('Duration (minutes)',{exact:true})).toHaveValue('10');await expect(page.getByLabel('Start time',{exact:true})).toHaveValue('08:00');
 const consent=page.getByRole('checkbox',{name:'Save this repeating routine in My Rhythm when I confirm'});await expect(consent).not.toBeChecked();expect((await saved(page)).routines).toHaveLength(0);
 await consent.check();await page.getByLabel('Start time',{exact:true}).fill('09:00');
 await page.getByRole('button',{name:'Confirm 1 activity'}).click();await expect(page.getByRole('heading',{name:'A little less on your mind.'})).toBeVisible();
 const data=await saved(page);expect(data.tasks).toHaveLength(1);expect(data.routines).toHaveLength(1);expect(data.routines[0]).toMatchObject({name:'Meditation',time:'09:00',duration:10,days:[0,1,2,3,4,5,6]});
 await page.reload();expect((await saved(page)).routines).toHaveLength(1);
});
