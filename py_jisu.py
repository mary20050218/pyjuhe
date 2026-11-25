# -*- coding: utf-8 -*-
# 球状闪电 / 极速追剧 (jisuzhuiju.com) —— TVBox Python 爬虫
# 来源：NG看看 v1.0.0 内置插件 plugins/jisu.js（HTML 抓取 + /api/play-url 取址）
# 不是 MacCMS：采集接口 404，只能抓 HTML；搜索参数叫 keyword；取址走 /api/play-url
import sys
import re
import json
import urllib.parse

sys.path.append('..')
try:
    from base.spider import Spider
except ImportError:
    class Spider:
        def fetch(self, url, headers=None, **kw):
            import requests as rq
            kw.pop('timeout', None)
            r = rq.get(url, headers=headers, timeout=15, **kw)
            r.encoding = 'utf-8'
            return r

HOST = "https://jisuzhuiju.com"
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"

CATEGORIES = {
    "": "推荐",
    "1": "电视剧",
    "2": "电影",
    "3": "动漫",
    "4": "综艺",
    "5": "短剧",
}

CARD_RE = re.compile(r'<a href="/detail/(\d+)\.html"[^>]*>\s*<div class="vod-card">([\s\S]*?)</div>\s*</div>\s*</a>')
SEARCH_RE = re.compile(r'<a href="/detail/(\d+)\.html"[^>]*class="search-item-poster"[^>]*>([\s\S]*?)</a>')
TITLE_RE = re.compile(r'<p class="vod-title[^"]*"[^>]*>([^<]*)</p>')
IMG_RE = re.compile(r'<img[^>]*src="([^"]+)"')
ALT_RE = re.compile(r'alt="([^"]*)"')
BADGE_RE = re.compile(r'<span class="vod-badge[^"]*"[^>]*>([^<]*)</span>')
TAB_RE = re.compile(r'data-target="source-(\d+)"[^>]*>([^<]*)</button>')
PANEL_RE = re.compile(r'<div class="source-panel"\s+id="source-(\d+)"')
EP_RE = re.compile(r'href="(/vodplay/(\d+)-([A-Za-z0-9]+)-(\d+)\.html)"[^>]*>([^<]*)<')
PAGE_RE = re.compile(r'data-page="(\d+)"')


def _strip(t):
    if not t:
        return ""
    t = re.sub(r'<br\s*/?>', '\n', t)
    t = re.sub(r'</(p|div|li|h[1-6])\s*>', '\n', t, flags=re.I)
    t = re.sub(r'<[^>]*>', '', t)
    t = t.replace('&lt;', '<').replace('&gt;', '>').replace('&quot;', '"')
    t = t.replace('&#39;', "'").replace('&nbsp;', ' ').replace('&amp;', '&')
    lines = [re.sub(r'[ \t\u00a0]+', ' ', ln).strip() for ln in t.split('\n')]
    return '\n'.join([ln for ln in lines if ln]).strip()


def _clean_title(t):
    v = _strip(t)
    for suf in ('封面图片', '海报', '封面'):
        if len(v) > len(suf) and v.endswith(suf):
            v = v[:-len(suf)].strip()
    return v


def _abs(p):
    p = (p or '').strip()
    if not p:
        return ''
    if p.startswith('//'):
        return 'https:' + p
    if p.startswith('http://') or p.startswith('https://'):
        return p
    if p.startswith('/'):
        return HOST + p
    return p


class Spider(Spider):
    def init(self, extend=""):
        return ""

    def _headers(self):
        return {
            "User-Agent": UA,
            "Accept-Language": "zh-CN,zh;q=0.9",
            "Referer": HOST + "/",
        }

    def _get(self, path):
        try:
            import requests as rq
            r = rq.get(HOST + path, headers=self._headers(), timeout=15)
            if r.status_code == 200:
                r.encoding = 'utf-8'
                return r.text
        except Exception:
            pass
        return ""

    def _vod_from_card(self, vid, block):
        m = TITLE_RE.search(block)
        name = m.group(1) if m else ""
        if not name:
            m = ALT_RE.search(block)
            name = m.group(1) if m else ""
        name = _clean_title(name)
        if not name:
            return None
        m = IMG_RE.search(block)
        pic = _abs(m.group(1)) if m else ""
        m = BADGE_RE.search(block)
        remark = _strip(m.group(1)) if m else ""
        return {
            "vod_id": vid,
            "vod_name": name,
            "vod_pic": pic,
            "vod_remarks": remark,
        }

    def _parse_cards(self, html):
        items, seen = [], set()
        for m in CARD_RE.finditer(html):
            vid, block = m.group(1), m.group(2)
            if vid in seen:
                continue
            v = self._vod_from_card(vid, block)
            if v:
                seen.add(vid)
                items.append(v)
        return items

    def _parse_search(self, html):
        items, seen = [], set()
        for m in SEARCH_RE.finditer(html):
            vid, seg = m.group(1), m.group(2)
            if vid in seen:
                continue
            im = re.search(r'<img[^>]*src="([^"]*)"[^>]*alt="([^"]*)"', seg)
            if not im:
                im = re.search(r'<img[^>]*alt="([^"]*)"[^>]*src="([^"]*)"', seg)
                if im:
                    name, pic = _clean_title(im.group(1)), _abs(im.group(2))
                else:
                    continue
            else:
                pic, name = _abs(im.group(1)), _clean_title(im.group(2))
            if not name:
                continue
            seen.add(vid)
            items.append({"vod_id": vid, "vod_name": name, "vod_pic": pic, "vod_remarks": ""})
        return items

    def _pagecount(self, html, pg):
        pages = [int(x) for x in PAGE_RE.findall(html)]
        if pages:
            return max(pages)
        return pg

    def homeContent(self, filter=False):
        cls = [{"type_id": k, "type_name": v} for k, v in CATEGORIES.items()]
        return {"class": cls, "list": []}

    def homeVideoContent(self):
        html = self._get("/")
        return {"list": self._parse_cards(html)}

    def categoryContent(self, tid, pg=1, filter=False, extend=""):
        try:
            pn = max(int(str(pg)), 1)
        except Exception:
            pn = 1
        cat = str(tid)
        if cat not in CATEGORIES:
            cat = ""
        if cat == "":
            html = self._get("/?page=%d" % pn if pn > 1 else "/")
        else:
            html = self._get("/filter?channel=%s&sort=hot&page=%d" % (cat, pn))
        items = self._parse_cards(html)
        return {"page": pn, "pagecount": self._pagecount(html, pn), "limit": 20, "total": 0, "list": items}

    def detailContent(self, ids):
        if isinstance(ids, list):
            vid = ids[0] if ids else ""
        else:
            vid = str(ids) if ids else ""
        vid = str(vid).split("/")[0]
        if not vid:
            return {"list": []}
        html = self._get("/detail/%s.html" % vid)
        if not html:
            return {"list": []}
        names = {}
        for m in TAB_RE.finditer(html):
            names[m.group(1)] = _strip(m.group(2))
        panels = [(m.group(1), m.start()) for m in PANEL_RE.finditer(html)]
        lines, play_from, play_url = [], [], []
        for n, (idx, start) in enumerate(panels):
            stop = panels[n + 1][1] if n + 1 < len(panels) else len(html)
            seg = html[start:stop]
            eps, seen_ep, prefix = [], set(), ""
            for em in EP_RE.finditer(seg):
                ep = int(em.group(4))
                if ep < 1 or ep in seen_ep:
                    continue
                seen_ep.add(ep)
                if not prefix:
                    prefix = em.group(3)
                label = _strip(em.group(5))
                # 取址要 playFrom=<prefix> + index=<ep>（1-based，绝不用 data-index）
                eps.append("%s$%s@%s@%d" % (label if label else ("第%d集" % ep), vid, prefix, ep))
            if not eps:
                continue
            lname = names.get(idx) or prefix or ("线路" + idx)
            lines.append(lname)
            play_from.append(lname)
            play_url.append("#".join(eps))
        # 剧名：og:title 里《》优先
        name = ""
        m = re.search(r'property="og:title"\s+content="([^"]*)"', html)
        if m:
            raw = _strip(m.group(1))
            b = re.search(r'《([^》]+)》', raw)
            if b:
                name = b.group(1).strip()
            elif raw:
                name = raw.split('高清')[0].strip()
        if not name:
            m = re.search(r'<title>([^<]*)</title>', html)
            if m:
                name = _strip(m.group(1)).split(' - ')[0].strip()
        pic = ""
        m = re.search(r'class="detail-poster-wrapper"[^>]*>\s*<img[^>]*src="([^"]+)"', html)
        if m:
            pic = _abs(m.group(1))
        if not pic:
            m = re.search(r'property="og:image"\s+content="([^"]*)"', html)
            if m:
                pic = _abs(m.group(1))
        intro = ""
        m = re.search(r'<meta\s+name="description"\s+content="([^"]*)"', html)
        if m:
            intro = _strip(m.group(1))
        if not intro:
            m = re.search(r'<meta\s+name="keywords"\s+content="([^"]*)"', html)
            if m:
                intro = _strip(m.group(1))
        return {"list": [{
            "vod_id": vid, "vod_name": name, "vod_pic": pic,
            "vod_content": intro, "vod_remarks": intro,
            "vod_play_from": "$$$".join(play_from),
            "vod_play_url": "$$$".join(play_url),
        }]}

    def searchContent(self, key, quick=False, pg="1"):
        k = str(key or "").strip()
        if not k:
            return {"list": []}
        html = self._get("/search?keyword=%s" % urllib.parse.quote(k))
        return {"list": self._parse_search(html)}

    def playerContent(self, flag, id, vipFlags=None, vipIds=None):
        tok = str(id or "").strip()
        if not tok or "@" not in tok:
            return {"url": ""}
        try:
            vid, prefix, ep = tok.rsplit("@", 2)
            ep = int(ep)
        except Exception:
            return {"url": ""}
        try:
            import requests as rq
            r = rq.get(
                "%s/api/play-url?vodId=%s&playFrom=%s&index=%d" % (HOST, vid, prefix, ep),
                headers=self._headers(), timeout=15)
            if r.status_code == 200:
                d = r.json()
                code = d.get("code")
                try:
                    code = int(code)
                except Exception:
                    code = -1
                if code == 200:
                    url = (d.get("url") or "").strip()
                    if url.startswith("http"):
                        return {"parse": 0, "url": url}
        except Exception:
            pass
        return {"url": ""}

    def localProxy(self, param):
        return None
