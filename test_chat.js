const fs = require('fs');
fetch('https://www.youtube.com/live_chat?is_popout=1&v=7eLqvW2GbCw').then(r=>r.text()).then(t=>{
    fs.writeFileSync('chat.html', t);
    const regex = /"contextMenuEndpoint"\s*:\s*(\{.*?\}|.*?)/g;
    let match;
    while((match = regex.exec(t)) !== null) {
        console.log(t.substring(match.index, match.index + 200));
        break;
    }
});
