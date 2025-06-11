const mineflayer = require('mineflayer');
const readline = require('readline');
const settings = require('./settings');
const settings2 = require('./settings2.json');
const util = require('util');
const { sleep } = require('openai/core.mjs');

// Override console.log to filter spam and add timestamp
const originalConsoleLog = console.log;
console.log = (...args) => {
  if (
    args.some(arg => typeof arg === "string" && arg.includes("Partial")) ||
    args.some(arg => typeof arg === "string" && arg.includes("Chunk size is")) ||
    args.some(arg => typeof arg === "string" && arg.includes("array size is"))
  ) {
    return;
  }
  const now = new Date();
  const time = now.toTimeString().split(" ")[0];
  const coloredTime = `\x1b[90m\x1b[4m[${time}]\x1b[0m`;
  originalConsoleLog(coloredTime, ...args);
};

// Array to hold all farmer instances
const farmers = [];

class SweetBerryFarmer {
  constructor(settings) {
    this.settings = settings;
    this.bot = null;
    this.clickCount = 0;
    this.startTime = null;
    this.cps = 0;
    this.moneyPerSec = 0;
    this.totalMoney = 0;
    this.eatingFood = false;
    this.outOfFoodLogged = false;
    this.rl = null;
    this.foods = ['bread', 'cooked_beef', 'cooked_chicken', 'cooked_porkchop', 'cooked_salmon', 'cookie', 'golden_apple', 'baked_potato', 'beetroot_soup', 'rabbit_stew', 'mushroom_stew', 'carrot'];

    farmers.push(this);
    this.initializeReadline();
    this.connect();
  }

  connect() {
    this.bot = mineflayer.createBot({
      host: this.settings.botsettings.host,
      username: this.settings.botsettings.account_email,
      version: this.settings.botsettings.version,
      port: this.settings.botsettings.port,
      auth: this.settings.botsettings.auth,
    });
    this.setupEventListeners();
  }

  setupEventListeners() {
    this.bot.on('spawn', async () => this.onSpawn());
    this.bot.on('error', (err) => this.onError(err));
    this.bot.on('kicked', (reason) => this.onKicked(reason));
    this.bot.on('end', (reason) => this.onEnd(reason));
    this.bot.on('windowOpen', (window) => this.onWindowOpen(window));
    this.bot.on('physicTick', () => this.onPhysicTick());
    this.bot.on('scoreboardCreated', () => this.scoreUpdated());
  }

  initializeReadline() {
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: '> '
    });

    this.rl.prompt();
    this.rl.on('line', (line) => this.handleCommand(line));
  }

  handleCommand(line) {
    const cmd = line.trim();
    if (cmd === '!farm') {
      this.farmCommand().catch(err => console.error('Error executing !farm command:', err));
    } else if (cmd.startsWith('!info')) {
      this.iteminfo(line.trim());
    } else {
      if (this.bot) this.bot.chat(cmd);
    }
    this.rl.prompt();
  }

  async farmCommand() {
    const searchPosition = this.bot.entity.position;
    const targetBlock = this.bot.findBlock({
      point: searchPosition,
      matching: block => block && block.name === 'sweet_berry_bush',
      maxDistance: 5
    });

    if (!targetBlock) {
      console.log('No sweet berry block found in a 5 block radius.');
      return;
    }

    console.log(`Found sweet berry block at ${JSON.stringify(targetBlock.position)}.`);
    await sleep(500);
    console.log('Starting to farm sweet berries using bonemeal.');

    this.startTime = Date.now();

    while (this.bot.inventory.items().some(item => item.name === 'bone_meal')) {
      if (!this.bot.inventory) this.bot.quit(' Inventory error ')
      const bonemealItem = this.bot.inventory.items().find(item => item.name === 'bone_meal');
      if (!bonemealItem) break;

      if (!this.bot.heldItem || !this.bot.heldItem.name.includes('bone_meal')) {
        await this.bot.equip(bonemealItem);
      }

      await this.bot.activateBlock(targetBlock);
      await sleep(12);
      this.clickCount++;

      const elapsedSec = (Date.now() - this.startTime) / 1000;
      this.cps = this.clickCount / elapsedSec;

      const worth = 27;
      const bone_cost = 63;
      this.totalMoney = (((this.clickCount / 3) * 2.5) * worth) - ((this.clickCount / 3) * (bone_cost / 3));
      this.moneyPerSec = ((this.cps / 3) * 2.5) * worth;
    }

    console.log('No more bonemeal left in inventory. Farming complete. Going to AFK 24');
    bot.chat('/afk 24')
  }

  scoreUpdated(){
    for (const scoreboardName in this.bot.scoreboard) {
      const scoreboard = this.bot.scoreboard[scoreboardName];
      if (typeof scoreboard !== 'undefined') {
        console.log(scoreboard);
      }
    }
  }

  checkAndEatFood() {
    // existing food logic
  }

  iteminfo(player) {
    // existing info logic
  }

  async onSpawn() {
    console.log('Bot has spawned.', this.bot.entity.username);
    await this.bot.waitForChunksToLoad();
    console.log('CHUNKS LOADED');
    await this.bot.waitForTicks(40);
    this.farmCommand().catch(err => console.error('Error executing !farm command:', err));

    // start global stats printer once
    if (farmers.length === 1) {
      setInterval(printCombinedStats, 1000);
    }
  }

  onError(err) { console.error('Bot encountered an error:', err); }
  onKicked(reason) { console.log(reason); }
  onEnd(reason) {
    console.log('Bot has disconnected. Reconnecting in 3 Minutes...', reason);
    setTimeout(() => this.connect(), 30000);
    console.log('Bot is reconnecting...');
  }
  onWindowOpen(window) { /* existing */ }
  onPhysicTick() { this.checkAndEatFood(); }
}

async function spawnfarmers() {
  new SweetBerryFarmer(settings);
  await sleep(7000);
  new SweetBerryFarmer(settings2);
}

function printCombinedStats() {
  const active = farmers.filter(f => f.startTime);
  if (active.length === 0) return;
  const sumCPS = active.reduce((sum, f) => sum + f.cps, 0);
  const sumMPS = active.reduce((sum, f) => sum + f.moneyPerSec, 0);
  const sumMoney = active.reduce((sum, f) => sum + f.totalMoney, 0);
  const avgCPS = (sumCPS / active.length).toFixed(2);
  const avgMPS = (sumMPS / active.length).toFixed(1);
  const totalMoney = sumMoney.toFixed(0);
  process.stdout.write(`\rCombined | Avg CPS: ${avgCPS} | Avg $/s: ${avgMPS}$ | Total $: ${totalMoney}`);
}

spawnfarmers();
