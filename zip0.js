// ZIP0影视 · drpy2 草稿（由 Forward 组件 zip0.com.resource 移植，2026-10-21）
// 接口链：GET /api/videos/search（JSON）→ 详情页 HTML 内嵌 episodes（name/url 直链 m3u8）→ 直接播放
// 无分类/推荐接口（原组件即搜索型），仅搜索 + 详情 + 播放。
// 实测（2026-10-21）：搜索 200、详情页集数齐全、ruyi 线 m3u8 可直接取流；个别 CDN（如 dyttzy）对机房 IP 返回 403，属出口 IP 问题。
var rule = {
    title: 'ZIP0影视',
    host: 'https://zip0.com',
    url: '',
    searchUrl: '/api/videos/search?query=**&page=fypage&limit=30',
    searchable: 2,
    quickSearch: 0,
    filterable: 0,
    headers: {
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
        'Referer': 'https://zip0.com/'
    },
    timeout: 15000,
    class_name: '',
    class_url: '',
    play_parse: true,
    lazy: `js:
input = {
  parse: 0,
  jx: 0,
  url: input,
  header: {
    'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
    'Referer': 'https://zip0.com/'
  }
};`,
    limit: 6,
    推荐: '',
    一级: '',
    二级: `js:
let html = request(input);
let dec = function (s) {
  try { return JSON.parse('"' + s + '"'); } catch (e) { return s; }
};
let field = function (key) {
  let m = html.match(new RegExp(key + '\\\\s*:\\\\s*"((?:\\\\\\\\.|[^"\\\\\\\\])*)"'));
  return m ? dec(m[1]) : '';
};
let start = html.lastIndexOf('episodes:');
let section = '';
if (start >= 0) {
  let end = html.indexOf('ssr:', start);
  section = html.slice(start, end > start ? end : html.length);
}
let eps = [];
let re = /\\bname\\s*:\\s*"((?:\\\\.|[^"\\\\])*)"\\s*,\\s*url\\s*:\\s*"((?:\\\\.|[^"\\\\])*)"/g;
let m;
while ((m = re.exec(section))) {
  let name = dec(m[1]) || '正片';
  let url = dec(m[2]);
  if (url && /^https?:\\/\\//i.test(url)) eps.push(name + '$' + url);
}
let pic = '';
let pm = html.match(/property="og:image"\\s+content="([^"]+)"/) || html.match(/"poster"\\s*:\\s*"([^"]+)"/);
if (pm) pic = pm[1];
VOD = {
  vod_id: input,
  vod_name: field('title'),
  vod_pic: pic,
  vod_remarks: field('sourceName'),
  vod_play_from: field('sourceName') || 'ZIP0',
  vod_play_url: eps.join('#')
};`,
    搜索: `js:
let d = [];
let j = JSON.parse(request(input));
(j.data || []).forEach(function (it) {
  d.push({
    vod_name: String(it.title || '').replace(/<[^>]+>/g, ''),
    vod_id: it.url,
    vod_pic: '',
    vod_remarks: String(it.remarks || '') + (it.year ? ' · ' + it.year : '')
  });
});
setResult(d);`
};
