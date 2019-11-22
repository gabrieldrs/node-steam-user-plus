const SteamCrypto = require('steam-crypto');
const request = require('request-promise-native');

function SteamWebLogOn (steamID, webLoginKey) {
	this._steamID = steamID;
	this._webLoginKey = webLoginKey;
}

SteamWebLogOn.prototype.startWebSession = function (callback) {
	var sessionKey = SteamCrypto.generateSessionKey();
	var logOnRequest = customRequest();


	var logOnProperties = {
		steamid: this._steamID,
		sessionkey: sessionKey.encrypted,
		encrypted_loginkey: SteamCrypto.symmetricEncrypt(
			Buffer.from(this._webLoginKey),
			sessionKey.plain
		)
	};

	logOnRequest(logOnProperties, (body) => {
		this.cookies = [
			'sessionid=' + this.sessionID,
			'steamLogin=' + body.authenticateuser.token,
			'steamLoginSecure=' + body.authenticateuser.tokensecure
		];

		callback(this.cookies);

	}, (msg) => {
		console.log("Error when trying to start web session");
		console.log(msg);
	});
};

//Private
function customRequest(){

	const reOptions = {
		uri: 'https://api.steampowered.com/ISteamUserAuth/AuthenticateUser/v1',
		qsStringifyOptions: { econder: bufferEncoder},
		json: true
	};

	return (args, success, error) => {

		reOptions.form = args;
		
		request.post(reOptions)
			.then(res  =>  success(res))
			.catch(err => error(err));

	}
}

function bufferEncoder(val, defaultEncoder) {
	return Buffer.isBuffer(val) ? val.toString('hex').replace(/../g, '%$&') : defaultEncoder(val)
}

module.exports = SteamWebLogOn;