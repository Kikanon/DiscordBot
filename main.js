const Discord = require('discord.js');
const Puppeteer = require('puppeteer');
const Canvas = require('canvas');
const JsBarcode = require('jsbarcode');
const MAX_CHROME_PAGES = 2;
let PREFIX = ">";
let CHROME_PAGES = 0;
const token = "MzY4NDIyNTU3ODgxMzM1ODEw.WeDePg.263kHD8VH8zxpc2EAl-88bNtRhI";

const client = new Discord.Client({ intents: ["GUILD_MESSAGES", "GUILDS", "DIRECT_MESSAGES", "GUILD_MESSAGE_REACTIONS", "DIRECT_MESSAGE_REACTIONS"] });

const delay = ms => new Promise(resolve => setTimeout(resolve, ms))

process.setMaxListeners(100);

async function genPetrolCode() {
  const browser = await Puppeteer.launch({ headless: true, executablePath: "/usr/bin/chromium" });

  const page = await browser.newPage();
  page.setDefaultTimeout(300000);

  await page.goto('https://www.kavanapotinagrajuje.si/');

  await delay(2000)

  await page.evaluate(() => popupClose());

  await page.waitForSelector('html body section.main div.main__slotMachine a.spin_link');
  await page.$eval("html body section.main div.main__slotMachine a.spin_link", el => { el.click(); })

  await page.waitForSelector('html body section.main div.main__code[style=""] div.title_code p');
  let element = await page.$('#award-title');

  let imeNagrade = await page.evaluate(el => el.textContent, element);
  let cookies = await page.cookies()

  let codeCookie = cookies.find(val => val.name == "award_code")
  if (!codeCookie) return null;

  let code = codeCookie.value

  await browser.close();

  return imeNagrade + " : " + code;
}

//-------------------- BOT READY --------------------
client.on('ready', () => {
  console.log('Bot ready');
  client.user.setActivity('Mind ur own biz')
});

//-------------------- BOT FUNCTIONS --------------------
client.on("messageCreate", async message => {
  if (false && message.author != client.user) {
    message.channel.send(message);
  }
});

client.on("messageCreate", async message => {
  if (String(message.content).startsWith(PREFIX + 'help')) {

    let helpText = "commands: \n \
    \t-help \n \
    \t-hackPetrol [num]\n \
    \t-barcode [code]\n \
    \t-setPrefix [prefix]"

    message.channel.send(helpText);
  }
});

client.on("messageCreate", async message => {
  if (String(message.content).startsWith(PREFIX + 'setPrefix')) {

    let pref = String((message.content.split(' ')[1]) || "");
    if (pref=='') return;

    PREFIX = pref;

    message.channel.send(`New prefix is now \'${PREFIX}\'`);
  }
});

client.on("messageCreate", async message => {
  if (String(message.content).startsWith(PREFIX + 'barcode')) {

    let code = String((message.content.split(' ')[1]) || "");
    if (code=='') return;

    let canvas = Canvas.createCanvas();
    //let ctx = canvas.getContext('2d');
    JsBarcode(canvas, code);

    let attachment = new Discord.MessageAttachment(canvas.toBuffer(), 'barcode.png');

    message.channel.send({ files: [attachment]});
  }
});

client.on("messageCreate", async message => {
  if (String(message.content).startsWith(PREFIX + 'hackPetrol')) {

    message.react('<:Profit:885976164412297226>');

    let number = parseInt((message.content.split(' ')[1]) || "1");
    if (!isFinite(number)) return;

    if(number+CHROME_PAGES>MAX_CHROME_PAGES)
    {
      message.channel.send(`Tu much, i ll bust or sum shit, trenutno lahko odpres se ${MAX_CHROME_PAGES-CHROME_PAGES}`);
      return;
    }
    CHROME_PAGES += number;

    let promises = [];

    for (let i = 0; i < number; ++i) {
      await delay(1200);
      promises.push(genPetrolCode().then( async code => {
        message.channel.send(code);
        --CHROME_PAGES;
      }));
    }

     await Promise.all(promises);

  }
});

client.login(token); //token na kraju uvek mora da bude
