const Discord = require('discord.js');
const Puppeteer = require('puppeteer');
const Canvas = require('canvas');
const JsBarcode = require('jsbarcode');
const Fs = require('fs');


const MAX_CHROME_PAGES = 2;
const DEAFULT_NICKNAME = '';
const DEAFULT_GUILD_DATA = {prefix:'>', nickname:'mr. bot', guild_name:''};


let CHROME_PAGES = 0;
let GUILDS_DATA = {};


// dw bout it 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
const token = "MzY4NDIyNTU3ODgxMzM1ODEw.WeDePg.263kHD8VH8zxpc2EAl-88bNtRhI";

const client = new Discord.Client({ intents: ["GUILD_MESSAGES", "GUILDS", "DIRECT_MESSAGES", "GUILD_MESSAGE_REACTIONS", "DIRECT_MESSAGE_REACTIONS"] });

const delay = ms => new Promise(resolve => setTimeout(resolve, ms))

process.setMaxListeners(100);

async function genPetrolCode() {
  const browser = await Puppeteer.launch({ headless: true }); // linux: executablePath: "/usr/bin/chromium"

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

async function saveConfig() {
  let data = JSON.stringify(GUILDS_DATA, null, 2);
  Fs.writeFileSync('guilds_data.json', data);
}

//-------------------- BOT READY --------------------
client.on('ready', async () => {
  console.log('Bot ready');

  try {
    let rawdata = Fs.readFileSync('guilds_data.json');
    GUILDS_DATA = JSON.parse(rawdata);
  }
  catch(e)
  {
    GUILDS_DATA = {}
  }

  client.guilds.cache.forEach(guild =>{
    if(GUILDS_DATA[guild.id] == undefined)
    {
      GUILDS_DATA[guild.id] = Object.assign({},DEAFULT_GUILD_DATA);
    }
    GUILDS_DATA[guild.id].guild_name = guild.name;
    guild.me.setNickname(GUILDS_DATA[guild.id].nickname + `[${GUILDS_DATA[guild.id].prefix}]`);
  });

  await saveConfig();
  client.user.setActivity('Mind ur own biz');
});

client.on("guildCreate", async guild => {
  console.log("Joined a new guild: " + guild.name);

  GUILDS_DATA[guild.id] = Object.assign({},DEAFULT_GUILD_DATA);
  guild.me.setNickname(GUILDS_DATA[guild.id].nickname + `[${GUILDS_DATA[guild.id].prefix}]`);

  GUILDS_DATA[guild.id].guild_name = guild.name;

  await saveConfig();
});

client.on("guildDelete", async guild => {
  console.log("Left a guild: " + guild.name);
  
  GUILDS_DATA[guild.id] = undefined;

  await saveConfig();
});

//-------------------- BOT FUNCTIONS --------------------
client.on("messageCreate", async message => {
  if (false && message.author != client.user) {
    message.channel.send(message);
  }
});

// HELP
client.on("messageCreate", async message => {
  if (String(message.content).startsWith(GUILDS_DATA[message.guild.id].prefix + 'help')) {

    let helpText = "commands: \n \
    \t-help \n \
    \t-hackPetrol [num]\n \
    \t-barcode [code]\n \
    \t-setPrefix [prefix]\n \
    \t-setNickname [nickname]"

    message.channel.send(helpText);
  }
});

client.on("messageCreate", async message => {
  if (String(message.content).startsWith(GUILDS_DATA[message.guild.id].prefix + 'setPrefix')) {

    let pref = String((message.content.split(' ')[1]) || "");
    if (pref=='') return;

    message.guild.me.setNickname( GUILDS_DATA[message.guild.id].nickname + ` [${pref}]`);

    GUILDS_DATA[message.guild.id].prefix = pref;

    message.channel.send(`New prefix is now \'${pref}\'`);

    await saveConfig();
  }
});

client.on("messageCreate", async message => {
  if (String(message.content).startsWith(GUILDS_DATA[message.guild.id].prefix + 'setNickname')) {

    let spaceIndex = message.content.indexOf(' ');

    if(spaceIndex == -1)
      return;

    let nickname = String(message.content.substr(spaceIndex + 1).trim());

    message.guild.me.setNickname( nickname + ` [${GUILDS_DATA[message.guild.id].prefix}]`);

    GUILDS_DATA[message.guild.id].nickname = nickname;

    message.channel.send(`My nickname is now \'${nickname}\'`);

    await saveConfig();
  }
});

client.on("messageCreate", async message => {
  if (String(message.content).startsWith(GUILDS_DATA[message.guild.id].prefix + 'barcode')) {

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
  if (String(message.content).startsWith(GUILDS_DATA[message.guild.id].prefix + 'hackPetrol')) {

    // emoji
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
