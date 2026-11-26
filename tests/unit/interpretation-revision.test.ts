import { describe, expect, it } from 'vitest';
import { OfflineAssistant } from '../../src/services/offlineAssistant';
import { emptyData, validateTask, type AppData } from '../../src/types';
import { approveRoutine } from '../../src/lib/planning';
const now = new Date(2026,10,25,9,0);
const parse = (text:string,data:AppData=emptyData(),at=now) => new OfflineAssistant().interpret(text,{data,now:at});
describe('targeted interpretation revision',()=>{
  it('separates an upcoming weekday from the meeting title',async()=>{
    expect((await parse('Meeting with professor Thursday')).tasks[0].draft).toMatchObject({title:'Meeting with professor',date:'2026-11-26'});
  });
  it('retains a relative date and explicitly resolves AM/PM',async()=>{
    const draft=(await parse('Study Evidence tomorrow at 3')).tasks[0].draft;
    expect(draft).toMatchObject({title:'Study Evidence',date:'2026-11-26',time:'',timeChoices:['03:00','15:00']});
    expect(()=>validateTask(draft)).toThrow('ambiguous time');
    expect(()=>validateTask({...draft,time:'15:00'})).not.toThrow();
    expect(()=>validateTask({...draft,timeChoices:undefined})).not.toThrow();
  });
  it.each(['Study Evidence tomorrow at 3 pm','Study Evidence tomorrow at 15:00','Study Evidence tomorrow afternoon at 3'])('resolves clear time: %s',async(text)=>{
    expect((await parse(text)).tasks[0].draft).toMatchObject({title:'Study Evidence',date:'2026-11-26',time:'15:00'});
  });
  it('uses the local calendar at midnight',async()=>{
    expect((await parse('Meeting with professor tomorrow',emptyData(),new Date(2026,10,25,23,59))).tasks[0].draft.date).toBe('2026-11-26');
  });
  it.each([
    ['Need to get groceries, milk, eggs, bread and steak',['milk','eggs','bread','steak']],
    ['Buy apples, oranges and tea',['apples','oranges','tea']],
    ['Pack socks, shoes and a toothbrush',['socks','shoes','a toothbrush']],
    ['Packing list:\n- passport\n- charger\n- jacket',['passport','charger','jacket']],
    ['Errands: collect parcel, return books and buy stamps',['collect parcel','return books','buy stamps']],
  ])('creates an editable grouped checklist: %s',async(text,items)=>{
    const result=await parse(text as string);expect(result.tasks).toHaveLength(1);
    expect(result.tasks[0].draft.checklist).toEqual((items as string[]).map(text=>({text,done:false})));
    expect(result.tasks[0].draft.kind).toBe('task');
  });
  it('keeps independent actions separate',async()=>{
    expect((await parse('Buy apples and call Alex')).tasks).toHaveLength(2);
    expect((await parse('Study biology and send an email')).tasks).toHaveLength(2);
  });
  it.each(['10 minute meditation','10-minute meditation','Meditation for 10 minutes'])('recognizes duration in fragments: %s',async(text)=>{
    expect((await parse(text)).tasks[0].draft).toMatchObject({title:'Meditation',kind:'task',duration:10});
  });
  it('recommends a future morning rather than scheduling in the past',async()=>{
    const draft=(await parse('Morning meditation',emptyData(),new Date(2026,10,25,18))).tasks[0].draft;
    expect(draft).toMatchObject({title:'Meditation',preferredPeriod:'morning',date:'2026-11-26',time:'08:00'});
  });
  it('combines duration, period and recurrence while avoiding saved routines',async()=>{
    const data=emptyData();data.routines.push({id:'breakfast',name:'Breakfast',kind:'routine',days:[0,1,2,3,4,5,6],time:'08:00',duration:60,exercises:[],createdAt:now.toISOString()});
    const draft=(await parse('10 minute morning meditation every day',data,new Date(2026,10,25,7))).tasks[0].draft;
    expect(draft).toMatchObject({title:'Meditation',kind:'task',duration:10,preferredPeriod:'morning',recurrence:{days:[0,1,2,3,4,5,6]}});
    expect(draft.time).not.toMatch(/^08:/);expect(data.routines).toHaveLength(1);
    approveRoutine(draft,data);expect(data.routines).toHaveLength(1);
    approveRoutine({...draft,saveAsRoutine:true},data);expect(data.routines).toHaveLength(2);
  });
  it('recognizes weekday recurrence and respects dated commitments',async()=>{
    const data=emptyData();data.tasks.push({id:'busy',title:'Busy',kind:'event',date:'2026-11-25',time:'08:00',duration:60,category:'Work',notes:'',priority:false,createdAt:now.toISOString(),completedAt:null});
    const draft=(await parse('Morning stretching every weekday',data,new Date(2026,10,25,7))).tasks[0].draft;
    expect(draft.recurrence?.days).toEqual([1,2,3,4,5]);expect(draft.time).not.toMatch(/^08:/);
  });
  it('keeps a separate sentence outside a grouped list',async()=>{
    const result=await parse('Get groceries, milk and eggs. Study biology tomorrow.');
    expect(result.tasks).toHaveLength(2);expect(result.tasks[0].draft.checklist).toHaveLength(2);expect(result.tasks[1].draft.title).toBe('Study biology');
  });
  it('recognizes selected recurring weekdays',async()=>{
    const draft=(await parse('Stretch for 15 minutes every Monday and Wednesday')).tasks[0].draft;
    expect(draft.title).toBe('Stretch');expect(draft.recurrence?.days).toEqual([1,3]);
  });
  it('does not infer a routine from an explicit note or negated activity',async()=>{
    const data=emptyData();const draft=(await parse('Do not meditate every day',data)).tasks[0].draft;
    expect(draft.kind).toBe('note');approveRoutine({...draft,saveAsRoutine:true},data);expect(data.routines).toHaveLength(0);
  });
});
