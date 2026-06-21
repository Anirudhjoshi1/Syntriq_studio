import puppeteer from "puppeteer";
const URL="http://localhost:5173/";
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const PHRASE="The quick brown fox jumps over the lazy dog 12345";

const b=await puppeteer.launch({headless:true,args:["--no-sandbox"]});
const pg=await b.newPage(); await pg.setViewport({width:1280,height:900});
const errors=[]; pg.on("pageerror",e=>errors.push(e.message));
await pg.goto(URL,{waitUntil:"networkidle0"});

// make a clean text PNG
const dataUrl=await pg.evaluate((phrase)=>{
  const c=document.createElement("canvas"); c.width=1300;c.height=200;
  const x=c.getContext("2d"); x.fillStyle="#fff";x.fillRect(0,0,1300,200);
  x.fillStyle="#111";x.font="44px Arial";x.textBaseline="middle";
  x.fillText(phrase,30,100);
  return c.toDataURL("image/png");
},PHRASE);
const buf=Buffer.from(dataUrl.split(",")[1],"base64");
const { writeFileSync }=await import("node:fs");
writeFileSync("test/ocr-input.png",buf);

await pg.waitForSelector(".tool-card");
await pg.evaluate(()=>[...document.querySelectorAll("button")].find(x=>x.textContent.trim().startsWith("Image to Text"))?.click());
await pg.waitForSelector("input[type=file]",{timeout:40000});
const inp=await pg.$("input[type=file]");
await inp.uploadFile("test/ocr-input.png");
await pg.waitForSelector(".ocr-file",{timeout:8000});
await pg.evaluate(()=>[...document.querySelectorAll("button")].find(x=>/Extract text/.test(x.textContent))?.click());

// wait for output (model download + recognize)
let out="";
for(let i=0;i<60;i++){
  await sleep(1500);
  out=await pg.$eval(".ocr-textarea",e=>e.value).catch(()=>"");
  if(out && out.trim().length>5 && !/Reading/.test(out)) break;
}
await b.close();

const got=out.toLowerCase();
const words=["quick","brown","fox","lazy","dog"];
const hits=words.filter(w=>got.includes(w));
const ok = hits.length>=4 && got.includes("12345") && errors.length===0;
console.log(JSON.stringify({ok, recognized: out.trim().slice(0,120), wordHits: hits.length+"/"+words.length, hasNumbers: got.includes("12345"), errors}, null, 2));
process.exit(ok?0:1);
