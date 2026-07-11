// 把 web 资产拷到 www/ 供 Capacitor 打包。
// 原生构建与 web 的差异：
//   1. 剥离 Service Worker 注册块——原生 app 无需离线缓存，且 SW 在 WKWebView 会导致 app 更新后内容陈旧
//   2. 不拷贝 sw.js（同上）
// web 源（仓库根，GitHub Pages 用）保持不变。
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const www = path.join(root, 'www');
if (!fs.existsSync(www)) fs.mkdirSync(www, { recursive: true });

const assets = ['index.html', 'app.js', 'data.js', 'styles.css', 'manifest.json', 'icon-192.png', 'icon-512.png', 'push.js', 'widget.js'];
const SW_BLOCK = /<script>\s*if \('serviceWorker' in navigator\)[\s\S]*?<\/script>/;

let copied = 0;
for (const f of assets) {
  const src = path.join(root, f);
  if (!fs.existsSync(src)) { console.warn('  [跳过] 缺失：' + f); continue; }
  let content = fs.readFileSync(src);
  if (f === 'index.html') {
    content = String(content).replace(SW_BLOCK, '<!-- SW 注册已为原生构建剥离（WKWebView 无需 SW）-->');
  }
  fs.writeFileSync(path.join(www, f), content);
  copied++;
}
console.log('www/ 构建完成，拷贝 ' + copied + ' 个文件。');
