// 驰时录（大师兄）· drpy2 草稿（由 Forward 组件 cheyong-rex 移植，2026-10-21）
// 接口链：单入口 POST http://app2.dsx.ac/ndsx.php/v7/logs（请求体 AES-128 加密、响应明文 JSON 信封 code=1）
//   method=search（搜索）→ method=video_detail（详情，vod_url_with_player 含各线路 标题$播放页 地址表）
//   → 播放：parse_secret 线路走 method=secret_parse_api_url；其余线路 GET parse_api+url（回包可能是 JSON/直链/RSA 加密串，RSA 用内置私钥参数 CRT 解密）
// 详情里每集的播放 id 是 base64(JSON) 载荷（原始地址+播放器 code+parse 配置+headers），lazy 里解开再解析。
// 无分类/列表接口（原组件即搜索型），仅搜索 + 详情 + 播放。RSA 解密需要引擎支持 BigInt（QuickJS 可以，老 Rhino 不行）。
// 实测（2026-10-21）：本机出口连不上 app2.dsx.ac（TCP 快速失败/超时，DNS 正常、多 IP 轮换池），全链路未在本机验证，需在用户网络下复验。
var rule = {
    title: '驰时录',
    host: 'http://app2.dsx.ac',
    url: '',
    searchUrl: '/dssearch?wd=**&pg=fypage',
    searchable: 2,
    quickSearch: 0,
    filterable: 0,
    headers: {
        'User-Agent': 'Dart/3.13 (dart:io)'
    },
    timeout: 20000,
    class_name: '',
    class_url: '',
    play_parse: true,
    lazy: `js:
let payload = null;
try {
  payload = JSON.parse(CryptoJS.enc.Base64.parse(String(input)).toString(CryptoJS.enc.Utf8));
} catch (e) {}
if (payload && payload.o) {
  let play = null;
  if (payload.secret) {
    try {
      let r = dsAPI('secret_parse_api_url', { url: payload.o, player_code: payload.c });
      play = dsPlayData(r.data);
    } catch (e) {}
  } else {
    let targets = dsParseTargets(payload);
    for (let i = 0; i < targets.length && !play; i++) {
      try {
        let txt = fetch(targets[i], { headers: { 'User-Agent': 'Dart/3.13 (dart:io)' }, timeout: 15000 });
        play = dsPlayData(dsReply(txt));
      } catch (e) {}
    }
    if (!play && /\\.(m3u8|mp4|mkv|mov)([?#]|$)/i.test(payload.o)) {
      play = { url: payload.o, headers: {} };
    }
  }
  if (play) {
    let hd = dsHeaders(payload.h);
    Object.keys(play.headers || {}).forEach(function (k) { hd[k] = play.headers[k]; });
    if (!hd['User-Agent'] && !hd['user-agent']) hd['User-Agent'] = 'Dart/3.13 (dart:io)';
    input = { parse: 0, jx: 0, url: play.url, header: hd };
  }
}`,
    预处理: `js:
// ==== 驰时录/大师兄 App API 移植（源自 Forward 组件 cheyong-rex）====
// 单入口 POST /ndsx.php/v7/logs：请求体 = base64url(随机IV + AES-128-CBC(JSON{method,data,csrf}))
// AES 密钥 = MD5(build + "^~!@#[-" + package)；响应为明文 JSON 信封（code=1）。
// 第三方 parse 接口的加密回包用内置 RSA 私钥参数做 CRT 解密（PKCS#1 v1.5，需要引擎支持 BigInt）。
var DS_BUILD = '1791855838435';
var DS_PACKAGE = 'com.zyx.cheyong';
var DS_RSA = {"p":"fbc7ab9d75533e39971e41b554990a57149ea3d115298d9d17630138a40f315339b7a69c6254dde2ffed520f5ad8c48fd2ef18ffd6c97ea0ca8d7329cf0146d5","q":"f36bda059d298c1cf92fae597fcccc5ccb715e3935b485cb4185d20c6c19a3249ca195f4e604ebf1c26f08f75174e72764499d722ee2e10232f16e3aacd9f0fb","dp":"7f28e1d0bd6f944eabb6d942c67e208dc85932ad273dfc4aa984141ad228e6257d51f670a6ecebbf78b81828af1e296fe5fd61a7dc87994f85dd189bb5f3941d","dq":"6d86a9a2bd0464b6e4a83f9aa596509db02c6268fb712e8236093069c67a029e069bee0d333223b7b3f4a1e42612a3af65c079c756b15eecce5f3369d33c7ce1","qi":"88911352f605c0254a3464d8333520eefdd06e5a985c1f88873714dfbb0764e9fa6b8e95e5e24369d6af22fb849a8c491d64f26e2fb566437b2de514838ca50b"};
var DS_HOST = 'http://app2.dsx.ac';
var DS_R = null;

function dsText(value) { return value == null ? '' : String(value).trim(); }

function dsReqBody(method, data) {
  var key = CryptoJS.MD5(DS_BUILD + '^~!@#[-' + DS_PACKAGE);
  var iv = CryptoJS.lib.WordArray.random(16);
  var input = {};
  Object.keys(data || {}).forEach(function (k) { input[k] = data[k]; });
  input.token = '';
  var body = JSON.stringify({ method: method, data: input, csrf: Date.now() });
  var enc = CryptoJS.AES.encrypt(body, key, { iv: iv, mode: CryptoJS.mode.CBC, padding: CryptoJS.pad.Pkcs7 });
  return iv.clone().concat(enc.ciphertext).toString(CryptoJS.enc.Base64).replace(/\\+/g, '-').replace(/\\//g, '_').replace(/=+$/, '');
}

function dsAPI(method, input) {
  var txt = fetch(DS_HOST + '/ndsx.php/v7/logs', {
    method: 'POST',
    body: dsReqBody(method, input),
    timeout: 20000,
    headers: {
      'User-Agent': 'Dart/3.13 (dart:io)', 'Content-Type': 'text/plain', version: '2.0.0',
      'version-number': '220', 'pk-id': DS_PACKAGE, 'build-time': DS_BUILD, platform: 'ios',
      'platform-version': 'Version 27.2 (Build 24B5110a)'
    }
  });
  var data = JSON.parse(txt);
  if (!data || Number(data.code) !== 1) throw new Error('驰时录接口未返回有效数据');
  return data;
}

function dsB64Bytes(value) {
  var t = dsText(value).replace(/-/g, '+').replace(/_/g, '/').replace(/\\s/g, '');
  while (t.length % 4) t += '=';
  var wa = CryptoJS.enc.Base64.parse(t);
  var out = [];
  for (var i = 0; i < wa.sigBytes; i++) out.push((wa.words[i >>> 2] >>> (24 - (i % 4) * 8)) & 255);
  return out;
}
function dsWordFromBytes(bytes) {
  var words = [];
  for (var i = 0; i < bytes.length; i++) words[i >>> 2] = (words[i >>> 2] || 0) | ((bytes[i] & 255) << (24 - (i % 4) * 8));
  return CryptoJS.lib.WordArray.create(words, bytes.length);
}
function dsPow(base, exponent, modulus) {
  var out = BigInt(1);
  base %= modulus;
  while (exponent > BigInt(0)) {
    if ((exponent & BigInt(1)) !== BigInt(0)) out = out * base % modulus;
    exponent >>= BigInt(1);
    if (exponent > BigInt(0)) base = base * base % modulus;
  }
  return out;
}
function dsRSA(value) {
  if (typeof BigInt !== 'function') throw new Error('当前 JS 引擎不支持 BigInt，无法解 parse 加密回包');
  if (!DS_R) DS_R = { p: BigInt('0x' + DS_RSA.p), q: BigInt('0x' + DS_RSA.q), dp: BigInt('0x' + DS_RSA.dp), dq: BigInt('0x' + DS_RSA.dq), qi: BigInt('0x' + DS_RSA.qi) };
  var bytes = dsB64Bytes(value), size = 128, decoded = [], r = DS_R;
  if (!bytes.length || bytes.length % size) throw new Error('parse 响应分块无效');
  for (var offset = 0; offset < bytes.length; offset += size) {
    var hex = '';
    for (var i = offset; i < offset + size; i++) hex += ('0' + bytes[i].toString(16)).slice(-2);
    var c = BigInt('0x' + hex), a = dsPow(c, r.dp, r.p), b = dsPow(c, r.dq, r.q);
    var h = (a - b) % r.p;
    if (h < BigInt(0)) h += r.p;
    var m = b + r.q * (r.qi * h % r.p);
    var blockHex = m.toString(16);
    while (blockHex.length < size * 2) blockHex = '0' + blockHex;
    var block = [];
    for (var z = 0; z < blockHex.length; z += 2) block.push(parseInt(blockHex.slice(z, z + 2), 16));
    var end = 2;
    while (end < block.length && block[end] !== 0) end++;
    for (var n = end + 1; n < block.length; n++) decoded.push(block[n]);
  }
  return CryptoJS.enc.Utf8.stringify(dsWordFromBytes(decoded));
}
function dsReply(value) {
  if (value && typeof value === 'object') return value;
  var text = dsText(value);
  if (/^[\\[{]/.test(text)) return JSON.parse(text);
  if (/^https?:\\/\\//i.test(text)) return { code: 200, url: text };
  return JSON.parse(dsRSA(text));
}
function dsValidURL(url) {
  var m = dsText(url).match(/^https?:\\/\\/([^/?#]+)/i);
  return !!m && !/@|\\s/.test(m[1]);
}
function dsHeaders(value) {
  var out = {};
  if (value && typeof value === 'object') {
    Object.keys(value).forEach(function (k) { out[k] = String(value[k]); });
    return out;
  }
  dsText(value).split(/\\r?\\n|\\\\n/).forEach(function (line) {
    var mm = line.match(/^\\s*([^:]+):\\s*(.*?)\\s*$/);
    if (mm) out[mm[1]] = mm[2];
  });
  return out;
}
function dsPlayData(object) {
  if (Array.isArray(object)) {
    for (var i = 0; i < object.length; i++) { var e = dsPlayData(object[i]); if (e) return e; }
    return null;
  }
  if (typeof object === 'string') return dsValidURL(object) ? { url: object, headers: {} } : null;
  if (!object || typeof object !== 'object') return null;
  if (object.code != null && [1, 200].indexOf(Number(object.code)) < 0) return null;
  if (typeof object.url === 'string' && dsValidURL(object.url)) return { url: object.url, headers: dsHeaders(object.headers || object.header) };
  return object.data && object.data !== object ? dsPlayData(object.data) : null;
}
function dsParseTargets(payload) {
  var apis = [payload.api].concat(dsText(payload.extra).split(/\\r?\\n/));
  var seen = {}, targets = [];
  apis.forEach(function (api) {
    api = dsText(api);
    if (!dsValidURL(api) || seen[api]) return;
    seen[api] = true;
    targets.push(api.indexOf('{url}') >= 0 ? api.replace(/\\{url\\}/g, encodeURIComponent(payload.o)) : api + encodeURIComponent(payload.o));
  });
  return targets.slice(0, 3);
}`,
    推荐: '',
    一级: '',
    二级: `js:
let vid = /^\\d+$/.test(String(input)) ? Number(input) : input;
let info = dsAPI('video_detail', { id: vid, sign_md5: '', apk_path: '', apk_length: 0 });
let detail = info.data && info.data.vod_info;
if (!detail) throw new Error('详情为空');
let froms = [];
let urls = [];
(detail.vod_url_with_player || []).forEach(function (s) {
  let eps = [];
  String(s.url || '').split('#').forEach(function (part) {
    let at = part.indexOf('$');
    if (at < 1) return;
    let payload = {
      o: part.slice(at + 1), c: String(s.code || ''), secret: !!s.parse_secret,
      api: s.parse_api || '', extra: s.extra_parse_api || '', h: s.headers || ''
    };
    let pid = CryptoJS.enc.Base64.stringify(CryptoJS.enc.Utf8.parse(JSON.stringify(payload)));
    eps.push(part.slice(0, at) + '$' + pid);
  });
  if (eps.length) {
    froms.push(String(s.name || s.code || '线路'));
    urls.push(eps.join('#'));
  }
});
VOD = {
  vod_id: String(detail.vod_id),
  vod_name: detail.vod_name || '',
  vod_pic: detail.vod_pic || '',
  vod_year: detail.vod_year || '',
  vod_area: detail.vod_area || '',
  vod_actor: detail.vod_actor || '',
  vod_director: detail.vod_director || '',
  vod_content: detail.vod_content || '',
  vod_play_from: froms.join('$$$'),
  vod_play_url: urls.join('$$$')
};`,
    搜索: `js:
let d = [];
let wd = '';
let pg = 1;
let m1 = input.match(/[?&]wd=([^&]*)/);
if (m1) wd = decodeURIComponent(m1[1]);
let m2 = input.match(/[?&]pg=(\\d+)/);
if (m2) pg = parseInt(m2[1]);
let found = dsAPI('search', { text: wd, pg: pg });
(found.data || []).forEach(function (it) {
  d.push({
    vod_name: it.vod_name,
    vod_id: String(it.vod_id),
    vod_pic: it.vod_pic || '',
    vod_remarks: it.vod_state || it.vod_year || ''
  });
});
setResult(d);`
};
