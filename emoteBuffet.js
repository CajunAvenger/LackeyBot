/* emoteBuffet
 holds all the emotes lackeybot uses
*/
var yeet = console.log; //use for temp logs to make them easy to differentiate from permanent ones
var boop = "boop"; 		//boop

//emote identifiers for reaction tech
//arrays to turn letters to regional letter emotes
const azArray = ["a","b","c","d","e","f","g","h","i","j","k","l","m","n","o","p","q","r","s","t","u","v","w","x","y","z"]
const azEmoteArray = ["🇦","🇧","🇨","🇩","🇪","🇫","🇬","🇭","🇮","🇯","🇰","🇱","🇲","🇳","🇴","🇵","🇶","🇷","🇸","🇹","🇺","🇻","🇼","🇽","🇾","🇿"]
const pinEmotes = ["📌","📍"]
const blank = "⬚", resetList = "📄"; //blank square emote
const leftArrow = "⬅️", rightArrow = "➡️", upArrow = "⬆️", downArrow = "⬇️", old_dollarEmote = "💲", old_excEmote = "❗", old_quesEmote = "❓", old_plainText = "💬", old_mag = "🔍", old_ruler = "📏", old_xEmote = "❌"
const forwardArrow = "↗️", backwardArrow = "↙️";
const old_hourEmote = "🕐", old_dayEmote = "🌞", old_weekEmote = "📆", old_repeatEmote = "🔄";
const plainText = "711733693542039562", mag = "711732431472033852", ruler = "711732431614378004", xEmote = "711732430549286912", dollarEmote = "711733693336518738", excEmote = "711732431278833665", quesEmote = "711732431408988230", tieEmote = "753837098771021877";
const hourEmote = "711732430461075527", dayEmote = "711732430658207864", weekEmote = "711732430532378677", repeatEmote = "711732431362850876", pingStar = "712533734687244321";
const collectToPlainMsg = 'This is a link collection embed. You can react ' + old_plainText + ' to convert to plaintext, but it will lose its formatting.';
const plainToCollectMsg = 'This was a link collection embed. You can react ' + old_plainText + ' to convert it back to an embed.';

//export{yeet, boop, azArray, azEmoteArray, blank, resetList, leftArrow, rightArrow, old_dollarEmote, old_excEmote, old_plainText, old_mag, old_ruler, old_quesEmote, old_xEmote, dollarEmote, excEmote, quesEmote, plainText, mag, ruler, xEmote, pinEmotes, tieEmote, hourEmote, dayEmote, weekEmote, repeatEmote, pingStar, old_hourEmote, old_dayEmote, old_weekEmote, old_repeatEmote, collectToPlainMsg, plainToCollectMsg}
//temp logs
exports.yeet = yeet;
exports.boop = boop;
//letter reactions
exports.azArray = azArray;
exports.azEmoteArray = azEmoteArray;
//1d embeds
exports.blank = blank;
exports.resetList = resetList;
exports.leftArrow = leftArrow;
exports.rightArrow = rightArrow;
//normal emote images
exports.old_dollarEmote = old_dollarEmote;
exports.old_excEmote = old_excEmote;
exports.old_quesEmote = old_quesEmote;
exports.old_plainText = old_plainText;
exports.old_mag = old_mag;
exports.old_ruler = old_ruler;
exports.old_quesEmote = old_quesEmote;
exports.old_xEmote = old_xEmote;
//custom/normal emote IDs
exports.dollarEmote = dollarEmote;
exports.excEmote = excEmote;
exports.quesEmote = quesEmote;
exports.plainText = plainText;
exports.mag = mag;
exports.ruler = ruler;
exports.quesEmote = quesEmote;
exports.xEmote = xEmote;
//reminder emotes
exports.hourEmote = hourEmote
exports.dayEmote = dayEmote
exports.weekEmote = weekEmote
exports.repeatEmote = repeatEmote
exports.pingStar = pingStar
exports.old_hourEmote = old_hourEmote
exports.old_dayEmote = old_dayEmote
exports.old_weekEmote = old_weekEmote
exports.old_repeatEmote = old_repeatEmote
//other random reactions
exports.pinEmotes = pinEmotes;
exports.tieEmote = tieEmote;
//embed link collections
exports.collectToPlainMsg = collectToPlainMsg;
exports.plainToCollectMsg = plainToCollectMsg;
