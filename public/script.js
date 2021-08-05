var browser = browser || chrome

// heroku endpoints
// const server_endpoint = 'https://ytmp3-converter.herokuapp.com/'
// const download_endpoint = 'https://ytmp3-converter.herokuapp.com/download/'

// locally
const server_endpoint = 'http://localhost:3000/'
const download_endpoint = 'http://localhost:3000/download/'

const submit_btn = document.getElementById("submit-btn")
const url_text_input = document.getElementById("url-text-input")

const loading_ring = document.getElementById("lds-ring")

const download_btn = document.getElementById("download-btn")
const thumbnail_img = document.getElementById("thumbnail_img")
const download_container = document.getElementById("download-container")

const artist = document.getElementById("artist")
const song_title = document.getElementById("song-title")
const song_duration = document.getElementById("song-duration")

window.onload = () => {
    var form = document.querySelector("form");
    form.addEventListener("submit", submitUrl, false);
    download_btn.onclick = clearTextInput
}

async function submitUrl(e){
    e.preventDefault();

    const params  = {
        url: url_text_input.value
    }
    const full_url = download_endpoint+'?'+ new URLSearchParams(params)

    submit_btn.disabled = true; 
    loading_ring.style.display = "block"
    clearData()

    let res = await fetch(full_url)
    let data = await res.json()
    console.log(data)
    
    loading_ring.style.display = "none"
    submit_btn.disabled = false; 
    download_btn.style.display = "block"
    // hack that prevents browser from caching the img
    thumbnail_img.src = addRandomQueryToPath(`${server_endpoint}data/thumbnail.jpg`)  
    download_container.style.display = "flex"
    artist.innerHTML = data.artist
    song_title.innerHTML = data.songTitle
    song_duration.innerHTML = data.duration

    // window.open(`${server_endpoint}${data.song}`);
    download_btn.href = `${server_endpoint}${data.songPath}`

    // blobNDownload()
}

function clearTextInput(){
    url_text_input.value = ""
}

function clearData(){
    download_btn.style.display = "none"
    download_btn.href = ""
    download_container.style.display = "none"
    thumbnail_img.src = ''
}

function addRandomQueryToPath(path){
    const randomPath = `${path}?dummy=${randomInt(100000)}`
    console.log(randomPath)
    return randomPath
}

function randomInt(max) {
    return Math.floor(Math.random() * max);
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

