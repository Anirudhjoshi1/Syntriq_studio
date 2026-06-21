import puppeteer from "puppeteer";
const URL="http://localhost:4173/";
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const b=await puppeteer.launch({headless:true,args:["--no-sandbox"]});
const pg=await b.newPage(); await pg.setViewport({width:1280,height:860});
const errors=[]; pg.on("pageerror",e=>errors.push(e.message)); pg.on("console",m=>m.type()==="error"&&errors.push(m.text()));
const open=async(name)=>{ await pg.goto(URL,{waitUntil:"networkidle0"}); await pg.waitForSelector(".tool-card"); await pg.evaluate(n=>[...document.querySelectorAll("button")].find(x=>x.textContent.trim().startsWith(n))?.click(),name); await sleep(1500); };
const out={};

// FOCUS TIMER: start, ensure clock ticks
await open("Focus Timer");
await pg.waitForSelector(".ft-clock",{timeout:8000});
const t1=await pg.$eval(".ft-clock",e=>e.textContent);
await pg.evaluate(()=>[...document.querySelectorAll("button")].find(x=>/Start/.test(x.textContent))?.click());
await sleep(2200);
const t2=await pg.$eval(".ft-clock",e=>e.textContent);
out.timerTicks = t1!==t2;

// FLASHCARDS: new deck, add card, study, flip
await open("Flashcards");
await pg.evaluate(()=>[...document.querySelectorAll("button")].find(x=>/New deck/.test(x.textContent))?.click());
await pg.waitForSelector(".fc-add textarea",{timeout:8000});
const tas=await pg.$$(".fc-add textarea");
await tas[0].type("Capital of France?"); await tas[1].type("Paris");
await pg.evaluate(()=>[...document.querySelectorAll("button")].find(x=>/Add card/.test(x.textContent))?.click());
await sleep(400);
out.cardAdded = (await pg.$$(".fc-card-row")).length===1;
// back to decks, study
await pg.evaluate(()=>[...document.querySelectorAll("button")].find(x=>/Decks/.test(x.textContent))?.click());
await sleep(400);
await pg.evaluate(()=>document.querySelector(".fc-study-btn")?.click());
await pg.waitForSelector(".fc-flip",{timeout:8000});
const frontVisible = await pg.$eval(".fc-front p",e=>e.textContent);
await pg.evaluate(()=>document.querySelector(".fc-flip-area")?.click());
await sleep(700);
out.flashcardOk = frontVisible.includes("France");

// QUICK NOTES: new note, type, verify persistence after reload
await open("Quick Notes");
await pg.evaluate(()=>[...document.querySelectorAll("button")].find(x=>/New note/.test(x.textContent))?.click());
await pg.waitForSelector(".qn-title",{timeout:8000});
await pg.type(".qn-title","Biology revision");
await pg.type(".qn-body","Mitochondria is the powerhouse of the cell.");
await sleep(500);
// reload and check it persisted
await pg.reload({waitUntil:"networkidle0"});
await open("Quick Notes");
await sleep(600);
const persisted = await pg.evaluate(()=>!![...document.querySelectorAll(".qn-item-title")].find(e=>/Biology revision/.test(e.textContent)));
out.notePersisted = persisted;

out.errors=errors;
await b.close();
console.log(JSON.stringify(out,null,2));
const ok = out.timerTicks && out.cardAdded && out.flashcardOk && out.notePersisted && errors.length===0;
process.exit(ok?0:1);
