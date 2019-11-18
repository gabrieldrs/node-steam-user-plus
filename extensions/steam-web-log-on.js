const SteamCrypto = require('steam-crypto');
const https = require('https');

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

	}, (statusCode) => {
		console.log("Error when trying to start web session");
		console.log(statusCode);
		console.log(body);
	});
};

//Private
function customRequest(){

	const options = {
		hostname: 'api.steampowered.com',
		path: '/ISteamUserAuth/AuthenticateUser/v1',
		method: 'POST',
		headers: {
			'Content-Type': 'application/x-www-form-urlencoded',
		}
	};

	return (args, success, error) => {

		var data = encodePayload(args);

		options.headers['Content-Length'] = data.length;
		
		var req = https.request(options, res  => {
			if (res.statusCode != 200) {
				return error(res.statusCode);
			}
			var data = '';
			res.on('data', (chunk) =>  data += chunk);
			res.on('end', () =>  success(JSON.parse(data)));
		});
		req.on('error', () => request(httpmethod, method, version, args, callback));

		req.end(data);
	}
}

function encodePayload(payload) {
	return Object.keys(payload).map(function(key) {
        const val = payload[key];
		if (Array.isArray(val))
			return val.map((val_, key_)  => key + '[' + key_ + ']=' + val_).join('&');
		else if (Buffer.isBuffer(val))
			return key + '=' + val.toString('hex').replace(/../g, '%$&');
		return key + '=' + encodeURIComponent(val);
	}).join('&');
}

module.exports = SteamWebLogOn;