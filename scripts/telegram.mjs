import axios from 'axios'
import { readFileSync } from 'fs'

const chat_id = '@OutClashChannel'
const pkg = readFileSync('package.json', 'utf-8')
const changelog = readFileSync('changelog.md', 'utf-8')
const { version } = JSON.parse(pkg)
const downloadUrl = `https://github.com/ckeiituk/outclash/releases/download/${version}`
let content = `<b>🌟 <a href="https://github.com/ckeiituk/outclash/releases/tag/${version}">OutClash v${version}</a> 正式发布</b>\n\n`
for (const line of changelog.split('\n')) {
  if (line.length === 0) {
    content += '\n'
  } else if (line.startsWith('### ')) {
    content += `<b>${line.replace('### ', '')}</b>\n`
  } else {
    content += `${line}\n`
  }
}

content += '\n<b>下载地址：</b>\n<b>Windows10/11：</b>\n'
content += `安装版：<a href="${downloadUrl}/outclash-windows-${version}-x64-setup.exe">64位</a> | <a href="${downloadUrl}/outclash-windows-${version}-ia32-setup.exe">32位</a> | <a href="${downloadUrl}/outclash-windows-${version}-arm64-setup.exe">ARM64</a>\n`
content += `便携版：<a href="${downloadUrl}/outclash-windows-${version}-x64-portable.7z">64位</a> | <a href="${downloadUrl}/outclash-windows-${version}-ia32-portable.7z">32位</a> | <a href="${downloadUrl}/outclash-windows-${version}-arm64-portable.7z">ARM64</a>\n`
content += '\n<b>Windows7/8：</b>\n'
content += `安装版：<a href="${downloadUrl}/outclash-win7-${version}-x64-setup.exe">64位</a> | <a href="${downloadUrl}/outclash-win7-${version}-ia32-setup.exe">32位</a>\n`
content += `便携版：<a href="${downloadUrl}/outclash-win7-${version}-x64-portable.7z">64位</a> | <a href="${downloadUrl}/outclash-win7-${version}-ia32-portable.7z">32位</a>\n`
content += '\n<b>macOS 11+：</b>\n'
content += `PKG：<a href="${downloadUrl}/outclash-macos-${version}-x64.pkg
">Intel</a> | <a href="${downloadUrl}/outclash-macos-${version}-arm64.pkg">Apple Silicon</a>\n`
content += '\n<b>macOS 10.15+：</b>\n'
content += `PKG：<a href="${downloadUrl}/outclash-catalina-${version}-x64.pkg
">Intel</a> | <a href="${downloadUrl}/outclash-catalina-${version}-arm64.pkg">Apple Silicon</a>\n`
content += '\n<b>Linux：</b>\n'
content += `DEB：<a href="${downloadUrl}/outclash-linux-${version}-amd64.deb
">64位</a> | <a href="${downloadUrl}/outclash-linux-${version}-arm64.deb">ARM64</a>\n`
content += `RPM：<a href="${downloadUrl}/outclash-linux-${version}-x86_64.rpm">64位</a> | <a href="${downloadUrl}/outclash-linux-${version}-aarch64.rpm">ARM64</a>`

await axios.post(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
  chat_id,
  text: content,
  link_preview_options: {
    is_disabled: false,
    url: 'https://github.com/ckeiituk/outclash',
    prefer_large_media: true
  },
  parse_mode: 'HTML'
})
