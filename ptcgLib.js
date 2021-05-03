// globals. generally things from the game that I don't want to load at runtime
const boosterRarities = [[1,5,3,1],[1,5,3,1],[0,6,3,1],[0,6,3,1]]
const generateRandomEnergy = 0x6387, generateEnergyLightningFire = 0x639c;
const generateEnergyWaterFighting = 0x63a1, generateEnergyGrassPsychic = 0x63a6
const generate10RandomEnergies = 0x6390;
var cardData, boosterData;
function initializeGameData(cardDataInput,boosterDataInput){
	cardData = cardDataInput;
	boosterData = boosterDataInput;
}

function createRandomObject(wRNG1, wRNG2, wRNGCounter){
	return {"wRNG1": wRNG1, "wRNG2": wRNG2, "wRNGCounter": wRNGCounter};
}

// runs both updateRNGSources and getRandomValue. Uses an object instead of params
function getAndUpdateRandom(upperBound, random){
	return getAndUpdateRandom_base(upperBound, random.wRNG1, random.wRNG2, random.wRNGCounter);
}

// runs both updateRNGSources and getRandomValue. Uses 3 rng params instead of an obj
function getAndUpdateRandom_base(upperBound, wRNG1, wRNG2, wRNGCounter){
	let rngUpdateVal = updateRNGSources(wRNG1, wRNG2, wRNGCounter);
	rngUpdateVal.random = getRandomValue(upperBound, rngUpdateVal.a);
	return rngUpdateVal;
}

/*
	Implements the end of the Random function from poketcg.
	Uses 'a' result of updateRNGSources.

	returns a single byte value between 0 and upperBound (exclusive)
*/
function getRandomValue(upperBound, rngOutput){
	return ((upperBound*rngOutput)>>8)&0xff;
}

/*
	Implementation of poketcg's updateRNGSources.
	blocks of code are annotated with the assembly lines they come from.
 	all line numbers are as of commit 6c74edb.

	returns an array containing a (rng val), wRNG1 (updated), wRNG2 (updated), wRNGCounter (incremented by 1)
*/
function updateRNGSources(wRNG1, wRNG2, wRNGCounter){
	// please excuse all the &0xff's. better safe than readable?

	// 1507 - 1519
	let a = wRNG2 << 2;
	let ahi = (a >> 8) & 0b11;
	a = ((((a&0xff)+ahi)^wRNG1)&0xff);
	let storef = a&0x1;
	let storea = ((a>>1)&0xff);

	// 1520 - 1526 
	let d = ((wRNG2 ^ wRNG1)&0xff);
	let e = ((wRNGCounter ^ wRNG1)&0xff);

	// 1527 - 1538
	let ehi = (e >> 7)&0x1;
	e = ((e<<1)&0xff) + storef;
	d = ((d<<1)&0xff) + ehi;
	a = ((d ^ e)&0xff);
	wRNGCounter+=1;
	if(wRNGCounter > 255){
		wRNGCounter-=256;
	}
	wRNG2 = d;
	wRNG1 = e;

	return { "a": a, "wRNG1": wRNG1, "wRNG2": wRNG2, "wRNGCounter": wRNGCounter };
}

// generate pack given rng object
function generateBooster(randObj, packType){
	return generateBooster_Base(randObj.wRNG1, randObj.wRNG2, randObj.wRNGCounter, packType);
}

// generate pack
function generateBooster_Base(wRNG1, wRNG2, wRNGCounter, packType){

	let currCardData = [...cardData];
	var rngState = {"wRNG1": wRNG1, "wRNG2": wRNG2, "wRNGCounter": wRNGCounter };
	// maps the possible card types to their position on the type rarity table
	var mapTypesCardToBooster = [1,0,3,2,4,5,6,-1,8,8,8,8,8,8,8,-1,7,-1];
	var mapTypesBoosterToCard = [1,0,3,2,4,5,6,16,-1]; // energies cannot be mapped
	function validCardsFilter(card){
		if(card.index === 0){
			return false;
		}
		if(((card.sets >> 4)&0x0f) !== currentPackInfo.boosterType){
			return false;
		}
		if(currentRarity !== card.rarity){
			return false;
		}
		return true;
	}

	let currentPackInfo = boosterData[packType];
	let energyList = [], cardList = [];
	var currentRarity = 2;
	var typeChancesLeft = [...currentPackInfo.cardTypeChances]; // type chances remaining
	var cardsOfRarityLeft = boosterRarities[currentPackInfo.boosterType];

	// "init" - zeroes some ranges and average the card type chances
	let typeChanceAvg = 0, len = 0;
	for (let x of currentPackInfo.cardTypeChances){
		if(x > 0)
			len++;
		typeChanceAvg+=x;
	}
	typeChanceAvg = Math.floor(typeChanceAvg/len);

	// energy generation
	if (currentPackInfo.energyGenHigh !== 0){
		let energyGenerator = (currentPackInfo.energyGenHigh << 8) + currentPackInfo.energyGenLow;
		// run specified energy generator function
		switch (energyGenerator){
			case generateRandomEnergy:
				rngState = getAndUpdateRandom(6, rngState);
				energyList.push(currCardData[rngState.random + 1]);
				break;
			case generateEnergyLightningFire:
				for(const i of [4,4,4,4,4,2,2,2,2,2])
					energyList.push(currCardData[i]);
				cardsOfRarityLeft = [0,0,0,0]
				break;
			case generateEnergyWaterFighting:
				for(const i of [3,3,3,3,3,5,5,5,5,5])
					energyList.push(currCardData[i]);
				cardsOfRarityLeft = [0,0,0,0];
				break;
			case generateEnergyGrassPsychic:
				for(const i of [1,1,1,1,1,6,6,6,6,6])
					energyList.push(currCardData[i]);
				cardsOfRarityLeft = [0,0,0,0];
				break;
			case generate10RandomEnergies:
				for(let i = 0; i<10; i++){
					rngState = getAndUpdateRandom(6,rngState);
					energyList.push(currCardData[rngState.random + 1]);
				}
				cardsOfRarityLeft = [0,0,0,0];
				break;
			default: console.log("Error: No Energy Generator for: " + energyGenerator.toString(16));
		}
	}else if(currentPackInfo.energyGenLow !== 0){
		// generate energy based on given type
		energyList.push(currCardData[currentPackInfo.energyGenLow]);
	}   // else no energy

	// card generation
	for (currentRarity of [2,1,0]){ // loop through the 3 rarities
		for(let i = 0; i < cardsOfRarityLeft[currentRarity+1]; i+=1){
			var currentRarityTypeChances = [0,0,0,0,0,0,0,0,0]; // chance for each type in current rarity
			var currentRarityCardTypes = [0,0,0,0,0,0,0,0,0]; // amount of cards of a given type in curr rarity

			let viableCards = currCardData.filter(validCardsFilter);

			// count viable cards per type
			for (const card of viableCards){
				currentRarityCardTypes[mapTypesCardToBooster[card.type]] += 1;
			}
			// get list of chances and total chance
			let totalChance = 0;
			for (let i = 0; i < currentRarityCardTypes.length; i++){
				if(currentRarityCardTypes[i] !== 0 && typeChancesLeft[i] !== 0){	
					totalChance += typeChancesLeft[i];
					currentRarityTypeChances[i] += typeChancesLeft[i];
				}
			}
			
			let selectedTypeIndex = 0;
			rngState = getAndUpdateRandom(totalChance, rngState);
			let currentRandom = rngState.random;

			for(selectedTypeIndex in currentRarityTypeChances){
				currentRandom -= currentRarityTypeChances[selectedTypeIndex];
				if(currentRandom < 0)
					break;
			}

			// reduce typeChance for current type
			typeChancesLeft[selectedTypeIndex] = Math.max(typeChancesLeft[selectedTypeIndex]-typeChanceAvg,1);
			// further filter the card list for currently viable types
			viableCards = viableCards.filter(card => card.type === mapTypesBoosterToCard[selectedTypeIndex]);

			rngState = getAndUpdateRandom(viableCards.length, rngState);
			let selectedCard = viableCards[rngState.random];
			currCardData.splice(currCardData.indexOf(selectedCard),1);
			cardList.push(selectedCard);
		}
	}
	return {"cards":cardList.concat(energyList), "rng":rngState};
}


export {generateBooster, initializeGameData,createRandomObject};

// following function(s) generates some data necessary for this from the rom of the game.
// the generated data is stored alongside this application, but I'm archiving this here
// in case I ever manage to expand this to custom roms (should they ever exist)
/*export function generateDataFromRom(gameData){
	const textOffset = 0x34000
	function get16BitValue(loc){
		return gameData[loc] + (gameData[loc+1] << 8)
	}
	// returns [bank, pos]
	function getLocalPosition(loc){
		if (loc < 0x4000){
			return [0,loc]
		}
		let bank = Math.floor(loc / 0x4000);
		return [bank, loc - (0x4000 * (bank-1))]
	}
	function getGlobalPosition(bank, localPos){
		if (bank < 3){
			return localPos
		}
		return localPos + (0x4000 * (bank-1))
	}
	function getTextFromTxtPtr(loc){
		var textPointerLoc = (get16BitValue(loc) * 0x3) + textOffset
		var textPointer = (get16BitValue(textPointerLoc) + (gameData[textPointerLoc+2]<<16)) + textOffset
		textPointer = textPointer + 1; // skip first byte as it's a half width marker
		var currentChar;
		var text = "";
		while ((currentChar = gameData[textPointer]) !== 0){
			let currChar = String.fromCharCode(currentChar)
			switch(currChar){
				case '`':
					text+='é';
					break;
				case '$':
					text+='♂';
					break;
				case '%':
					text+='♀';
					break;
				case '\"':
					text+='”';
					break;
				default:
					text+=currChar;
			}

			textPointer+=1;
		}
		return text
	}

	let cardList = [{"index":0}] // global temp
	let pokeCardsListLoc = 0x30c5c; // skip 0000 at the beginning
	let cardsListBank = getLocalPosition(pokeCardsListLoc)[0]
	let cardPtr;
	let i = 1;
	while((cardPtr = get16BitValue(pokeCardsListLoc + 2*i)) !== 0){
		let loc = getGlobalPosition(cardsListBank, cardPtr)
		let cardObj = {
			"name":getTextFromTxtPtr(loc+3),
			"type":gameData[loc],
			"rarity":gameData[loc+5],
			"sets":gameData[loc+6],
			"index":i
			}
		i += 1;
		cardList.push(cardObj)
	}
	//console.log((JSON.stringify(cardList)))

	let boosterDataJumpTable = 0x1e480
	let boosterDataBank = getLocalPosition(boosterDataJumpTable)[0]
	let boosterData = []
	for (let i = 0; i < 29; i++){ // standard poketcg has 29 booster types
		let loc = getGlobalPosition(boosterDataBank, get16BitValue(boosterDataJumpTable + 2*i))
		let boosterObj = {
			"boosterType": gameData[loc],
			"energyGenLow": gameData[loc+1],
			"energyGenHigh": gameData[loc+2],
			"cardTypeChances": [ gameData[loc+3],gameData[loc+4],
						gameData[loc+5],gameData[loc+6],
						gameData[loc+7],gameData[loc+8],
						gameData[loc+9],gameData[loc+10],
						gameData[loc+11]]
		}
		boosterData.push(boosterObj)
	}
	console.log((JSON.stringify(boosterData)))
}*/
