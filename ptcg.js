import {initializeGameData,generateBooster,createRandomObject} from "./ptcgLib.js";
import {getCardDataJson} from "./assets/cardData.js";
import {getBoosterDataJson} from "./assets/boosterData.js";
import fs from 'fs'

let cardData = JSON.parse(getCardDataJson());
let boosterData = JSON.parse(getBoosterDataJson());
initializeGameData(cardData,boosterData);
let randomObject = createRandomObject(0xf3, 0x64, 0x53);

for(let i = 0; i < 5; i++){
	let ret = generateBooster(randomObject, 1);
	randomObject = ret.rng;
	console.log(ret.cards);
}
