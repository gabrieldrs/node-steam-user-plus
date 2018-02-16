const util = require('util');
const fs = require('fs');

const Steam = require('steam');
const SteamUser = Steam.SteamUser;
const EMsg = Steam.EMsg;
const EResult = Steam.EResult;
var schema = Steam.Internal;

const WebLogOn = require('./extensions/steam-web-log-on');

const request = require('request');
const Cheerio = require('cheerio');

function SteamUserPlus(steamClient) {
    SteamUserPlus.super_.call(this,steamClient);
    this.loginFailReason=null;
}
util.inherits(SteamUserPlus, SteamUser);


// Methods

SteamUserPlus.prototype.badgeList = function(cb){
    this.emit('debug',"Requiring badges");
    var returnList = [];

    if (!this._cookies){
        this.emit('error','Before getting the list of badges, you must login.')
        this._client.disconnect()
        return;
    }
    
    var req = requestWithCookies(this._cookies);
    var self = this;
    req.get('http://steamcommunity.com/my/badges/',function(err,resp,body){
        if (err){
            self._client.disconnect()
            return;
        }
        self.emit('debug','Badge list downloaded successfully');
        var $ = Cheerio.load(body);
        var badge_games = $('.badge_row_inner').get(); 
        for (var i = 0 ; i < badge_games.length ; i++){
            let game_info = $('.badge_title_row',badge_games[i]);
            let raw_progress = $('.progress_info_bold', game_info).html()
            if (!raw_progress) continue;
            let remaining_drops = raw_progress.split(' ')[0];
            if (remaining_drops == 'No') remaining_drops = 0;

            let raw_title = $('.badge_title', game_info).text();
            let game_title = raw_title.replace("View details","").trim();

            let info_dialog_id = $('.card_drop_info_dialog', game_info).attr('id');
            let game_id = info_dialog_id.replace('card_drop_info_gamebadge_','').split('_')[0];

            let raw_hours_played = $('.badge_title_stats_playtime',game_info).text();
            let hours_played = raw_hours_played.split(" ")[0].trim() || '0';

            let unlocked_date = "Locked";
            if ($('.badge_info_unlocked', badge_games[i]).length > 0){
                unlocked_date = $('.badge_info_unlocked',badge_games[i]).text().replace(/Unlocked |[\n\t]/g,"");
            }

            let badge_level = 0;
            if ($('.badge_info_title+div',badge_games[i]).length > 0){
                let blevel = $('.badge_info_title+div',badge_games[i]).text();
                let match = /Level ([0-9]+)/.exec(blevel);
                if (match) badge_level = parseInt(match[1]);
                
            }

            returnList.push({
                game_title: game_title,
                game_id: game_id,
                remaining_drops: parseInt(remaining_drops),
                hours_played: parseFloat(hours_played),
                unlocked_date: unlocked_date || "Locked",
                level: badge_level || 0
            });
        }
        self.emit('debug','Badge list parsed successfully');
        return cb(returnList);
    });
}

SteamUserPlus.prototype.logOn = function(logOnDetails){
    this.emit('debug','Starting logOn');
    SteamUserPlus.super_.prototype.logOn.call(this,logOnDetails);
    var logonCB = function(data){
        this._client.removeListener('logOnResponse',logonCB);
        if (authenticationError(this,data)) return;

        var logOn = new WebLogOn(this._client.steamID,data.webapi_authenticate_user_nonce);
        logOn.startWebSession(function(cookies){
            this._cookies = cookies;
            this.emit('debug','LogOn success, cookies generated.');
            this.emit('webLogOnResponse');
        }.bind(this))
    }.bind(this)
    this._client.on('logOnResponse',logonCB)
}

module.exports = SteamUserPlus;


// Private
function requestWithCookies(cookies){
    var jar_of_cookies = request.jar()
    for (var i = 0; i < cookies.length;i++){
        jar_of_cookies.setCookie(request.cookie(cookies[i]), 'http://steamcommunity.com');
        jar_of_cookies.setCookie(request.cookie(cookies[i]), 'http://store.steampowered.com');
        jar_of_cookies.setCookie(request.cookie(cookies[i]), 'https://store.steampowered.com');
    }
    jar_of_cookies.setCookie(request.cookie("Steam_Language=english"), 'http://steamcommunity.com');
    return request.defaults({jar:jar_of_cookies});
}

function authenticationError(self,response){
    console.log(response);
    if (response.eresult == EResult.OK) return false;
    switch (response.eresult) {
        case EResult.AccountLoginDeniedNeedTwoFactor:
            self.emit('error',"Missing two factor auth code");
            self.loginType = "two_factor";
            break;
        case EResult.TwoFactorCodeMismatch:
            self.emit('error',"Two factor auth code wrong")
            self.loginType = "two_factor";
            break;
        case EResult.InvalidPassword:
            self.emit('error',"Invalid Password or Token")
            break;
        case EResult.AccountLogonDenied:
            self.emit ('error','Email token generated')
            self.loginType = "email";
            break;
        case EResult.InvalidLoginAuthCode:
            self.emit ('error','Email token invalid')
            break;
        default:
            self.emit('error',"Unknown Error")
            break;
    }
    self._client.disconnect();
    return true;
}