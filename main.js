const Discord = require('discord.js');
const Puppeteer = require('puppeteer');
const Canvas = require('canvas');
const JsBarcode = require('jsbarcode');
const Fs = require('fs');
const Os = require('os');
const chromePath = require('get-chrome');

const VERSION = 0.01;
const MAX_CHROME_PAGES = 2;
const DEAFULT_NICKNAME = '';
const DEAFULT_GUILD_DATA = {prefix:'>', nickname:'mr. bot', guild_name:''};
const DEBUG = true;


let CHROME_PAGES = 0;
let GUILDS_DATA = {};

const token = "discordApiToken";

const client = new Discord.Client({ intents: ["GUILD_MESSAGES", "GUILDS", "DIRECT_MESSAGES", "GUILD_MESSAGE_REACTIONS", "DIRECT_MESSAGE_REACTIONS"] });

const delay = ms => new Promise(resolve => setTimeout(resolve, ms))

process.setMaxListeners(100);

async function genPetrolCode() {

  const browser = (Os.type=="Linux")?await Puppeteer.launch({ headless: true, executablePath: chromePath() }):await Puppeteer.launch({ headless: true });

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

//-------------------- BOT READY AND GUILD JOINS AND LEAVES--------------------
client.on('ready', async () => {
  console.log(`Running on ${Os.type()}`);
  console.log(`Debug: ${DEBUG}`);
  console.log(`Version: ${VERSION}`);

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

// ------------------------ MESSAGE HANDLER --------------------------------
client.on("messageCreate", async message => {
  if(DEBUG && message.guild.name!="LawnMower2") return;
  if(message.author.bot) return;
  if(!message.member.permissions.has('ADMINISTRATOR')) return;
  if(!message.content.startsWith(GUILDS_DATA[message.guild.id].prefix)) return;

  let spaceIndex = message.content.indexOf(' ');
  let data = message.content.slice(spaceIndex).trim();

  if(spaceIndex == -1){
    spaceIndex = undefined;
    data = '';
  }

  switch(message.content.slice(GUILDS_DATA[message.guild.id].prefix.length, spaceIndex)){
    case "help": await help(message); break;
    case "hackPetrol": await hackPetrol(message, data); break;
    case "barcode": await barcode(message, data); break;
    case "setPrefix": await setPrefix(message, data); break;
    case "setNickname": await setNickname(message, data); break;
    case "purge": await purge(message, data); break;
    case "count": await count(message, data); break;
    case "react": await react(message, data); break;
    case "note": await note(message, data); break;
    case "rmNote": await rmNote(message, data); break;
    case "notes": await notes(message, data); break;
    case "test": await test(message, data); break;
    default: return;
  }

});

//-------------------- BOT FUNCTIONS --------------------

async function help(message){
    let pref = GUILDS_DATA[message.guild.id].prefix;
    let helpText = `commands: \n \
    \t${pref}help \n \
    \t${pref}hackPetrol [num]\n \
    \t${pref}barcode [code]\n \
    \t${pref}setPrefix [prefix]\n \
    \t${pref}setNickname [nickname]\n \
    \t${pref}purge [num] {can also reply to provide purge point}\n \
    \t${pref}note [text]\n \
    \t${pref}rmNote [num]\n \
    \t${pref}notes [num]\n \
    \t${pref}react [message_id] [emoji name]`

    message.channel.send(helpText);
}

async function setPrefix(message, data){
  if (data == '') return;

  message.guild.me.setNickname( GUILDS_DATA[message.guild.id].nickname + ` [${data}]`);

  GUILDS_DATA[message.guild.id].prefix = data;

  message.channel.send(`New prefix is now \'${data}\'`);

  await saveConfig();
}

async function setNickname(message, data){
  if(data == '') return;

  message.guild.me.setNickname( data + ` [${GUILDS_DATA[message.guild.id].prefix}]`);

  GUILDS_DATA[message.guild.id].nickname = data;

  message.channel.send(`My nickname is now \'${data}\'`);

  await saveConfig();
}

async function barcode(message, data){
  if (data == '') return;

  let canvas = Canvas.createCanvas();
  JsBarcode(canvas, data);

  let attachment = new Discord.MessageAttachment(canvas.toBuffer(), 'barcode.png');

  message.channel.send({ files: [attachment]});
}

async function hackPetrol(message, data){
  let number = parseInt(data);
  if (!isFinite(number)) number = 1;

  if(number + CHROME_PAGES > MAX_CHROME_PAGES)
  {
    message.channel.send(`Tu much, i ll bust or sum shit, trenutno lahko odpres se ${MAX_CHROME_PAGES-CHROME_PAGES} hackBotov`);
    return;
  }

  // emoji
  message.react('<:Profit:885976164412297226>');

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

async function purge(message, data){
  if(message.reference)
  {
    let purgeId = message.reference.messageId;
    let found = false;
    let deleteCount = 0;

    do {
      let messages = await message.channel.messages.fetch({ limit: 50 });

      if(messages.has(purgeId)){
        found = true;
      }
      else{

      deleteCount += messages.size;
      await message.channel.bulkDelete(messages);
      }
    }while(!found);

    let messages = await message.channel.messages.fetch({ after: purgeId });

    messages.set(purgeId, await message.channel.messages.fetch(purgeId));

    deleteCount += messages.size;
    await message.channel.bulkDelete(messages);

    message.channel.send(`Purged ${deleteCount} messages`);

  } 
  else
  {
    let purgeCount = parseInt(data);
    if(!purgeCount)purgeCount = 1;
    else ++purgeCount;
    if(purgeCount > 100)purgeCount=100;

    let messages = await message.channel.messages.fetch({ limit: purgeCount });

    message.channel.bulkDelete(messages);

    message.channel.send(`Purged ${messages.size} messages`);

  }
}

async function count(message, data){
  let number = parseInt(data);
  if(!number)number = 1;

  for(let i=0;i < number; ++i)
    message.channel.send(String(i+1));

}

async function react(message, data){
  let message_id = data.split(" ")[0];
  let emoji_name = data.slice( data.indexOf(" ") + 1 ).replace(" ", "_");

  try{
    if( client.emojis.cache.find(emoji => emoji.name == emoji_name) ){
      let msg = await message.channel.messages.fetch(message_id);
      msg.react(client.emojis.cache.find(emoji => emoji.name == emoji_name).id);
    }
    else {
      message.channel.send("idk man, crack is hard to find");
    }
  }
  catch(e)
  {}
  
  await message.delete();

  return;
}

// those 3 kinda lame
async function note(message, data){
  if(data == '')return;

  if(GUILDS_DATA[message.guild.id].notes == undefined){
    GUILDS_DATA[message.guild.id].notes = {};
    GUILDS_DATA[message.guild.id].notes[0] = data;
  }
  else {
    let key = parseInt(Object.keys(GUILDS_DATA[message.guild.id].notes).at(-1))+1;
    GUILDS_DATA[message.guild.id].notes[key] = data;
  }
  
  message.channel.send(`Note \`${data}\` added to notes`);
 
  await saveConfig();

}

async function rmNote(message, data){
  if(data == '')return;

  delete GUILDS_DATA[message.guild.id].notes[data];

  await saveConfig();
}

async function notes(message, data){
  let Output = '';
  Object.keys(GUILDS_DATA[message.guild.id].notes).forEach(key => {
    Output += `${key} ${GUILDS_DATA[message.guild.id].notes[key]}\n`
  });

  message.channel.send(`\`\`\`${Output}\`\`\``);
}

client.login(token); //token na kraju uvek mora da bude
