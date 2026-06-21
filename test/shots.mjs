import puppeteer from "puppeteer";
const URL="http://localhost:4173/";
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const b=await puppeteer.launch({headless:true,args:["--no-sandbox"]});
const pg=await b.newPage(); await pg.setViewport({width:1280,height:840});
const open=async(n)=>{ await pg.goto(URL,{waitUntil:"networkidle0"}); await pg.waitForSelector(".tool-card"); await pg.evaluate(x=>[...document.querySelectorAll("button")].find(e=>e.textContent.trim().startsWith(x))?.click(),n); await sleep(1600); };
await open("Focus Timer"); await pg.screenshot({path:"test/shot-timer.png"});
await open("Flashcards"); await pg.screenshot({path:"test/shot-cards.png"});
await b.close(); console.log("done");
