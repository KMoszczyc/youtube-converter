var browser = browser || chrome
// 'http://localhost:3000/'
const server_endpoint = 'https://ytmp3-converter.herokuapp.com/'
const download_endpoint = 'https://ytmp3-converter.herokuapp.com/download/'


window.onload = () => {
    var form = document.querySelector("form");
    form.addEventListener("submit", submitUrl, false);
}

async function submitUrl(e){
    e.preventDefault();

    document.getElementById("submit-btn").disabled = true; 
    document.getElementById("lds-ring").style.display = "inline-block"

    const params  = {
        url: document.getElementById("url-text-input").value
    }

    const full_url = download_endpoint+'?'+ new URLSearchParams(params)

    let res = await fetch(full_url)
    let data = await res.json()
    console.log(data)
    
    document.getElementById("lds-ring").style.display = "none"
    document.getElementById("url-text-input").value = ""
    document.getElementById("submit-btn").disabled = false; 

    window.open(`${server_endpoint}${data.song}`);

    // blobNDownload()
}

async function blobNDownload(res){
    let blob = await res.blob()
    var file = window.URL.createObjectURL(blob);
    let link=document.createElement('a');
    link.setAttribute('download', 'song.mp3');
    document.body.appendChild(link);
    link.href=file ;
    link.click();
}

