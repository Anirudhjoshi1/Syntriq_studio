import puppeteer from "puppeteer";
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const b=await puppeteer.launch({headless:true,args:["--no-sandbox"]});
const pg=await b.newPage(); await pg.setViewport({width:1280,height:860});
await pg.goto("http://localhost:5173/",{waitUntil:"networkidle0"});
await pg.waitForSelector(".tool-card");
await pg.evaluate(()=>[...document.querySelectorAll("button")].find(x=>x.textContent.trim().startsWith("Image to Text"))?.click());
await pg.waitForSelector("input[type=file]",{timeout:40000});
const inp=await pg.$("input[type=file]");
await inp.uploadFile("test/ocr-input.png");
await pg.waitForSelector(".ocr-file",{timeout:8000});
await pg.evaluate(()=>[...document.querySelectorAll("button")].find(x=>/Extract text/.test(x.textContent))?.click());
for(let i=0;i<40;i++){ await sleep(1200); const v=await pg.$eval(".ocr-textarea",e=>e.value).catch(()=>""); if(v&&/quick/.test(v)) break; }
await sleep(500);
await pg.screenshot({path:"test/shot-ocr.png"});
await b.close(); console.log("done");
