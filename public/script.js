var browser = browser || chrome

// heroku endpoints
const server_endpoint = 'https://ytmp3-converter.herokuapp.com/'
const download_endpoint = 'https://ytmp3-converter.herokuapp.com/download/'
const get_info_endpoint = 'https://ytmp3-converter.herokuapp.com/getInfo/'


// locally
// const server_endpoint = 'http://localhost:3000/'
// const download_endpoint = 'http://localhost:3000/download/'
// const get_info_endpoint = 'http://localhost:3000/getInfo/'


const submit_btn = document.getElementById("submit-btn")
const url_text_input = document.getElementById("url-text-input")

const get_info_ring = document.getElementById("get-info-ring")
const convert_ring = document.getElementById("convert-ring")

const convert_btn = document.getElementById("convert-btn")
const download_btn = document.getElementById("download-btn")
const thumbnail_img = document.getElementById("thumbnail_img")
const download_container = document.getElementById("download-container")

const artist = document.getElementById("artist")
const song_title = document.getElementById("song-title")
const song_duration = document.getElementById("song-duration")
const bitrate_select = document.getElementById('bitrate-select');

const url_error_box = document.getElementById("url-error-box")

let songInfo = null

const EMPTY_URL_ERROR = "You cannot send empty url!"

window.onload = () => {
    var form = document.querySelector("form");
    form.addEventListener("submit", getSongInfo, false);
    download_btn.onclick = clearDataAfterDownload
    convert_btn.onclick = convertSong
}

async function getSongInfo(e){
    e.preventDefault();

    if(url_text_input.value==""){
        url_error_box.innerHTML = EMPTY_URL_ERROR
        url_error_box.style.display="inline-block"
        return
    }
    else {
        url_error_box.style.display="none"
    }

    const full_url = get_info_endpoint+'?'+ new URLSearchParams({ url: url_text_input.value })

    // submit_btn.disabled = true; 
    
    get_info_ring.style.display = "block"
    clearData()

    let res = await fetch(full_url)
    let data = await res.json()
    songInfo = data
    console.log(data)

    if(data.error!=""){
        url_text_input.value = ""
        url_error_box.innerHTML = data.error
        url_error_box.style.display="inline-block"
        get_info_ring.style.display = "none"
        return
    }
    
    get_info_ring.style.display = "none"
    submit_btn.disabled = false; 
    // hack that prevents browser from caching the img
    // thumbnail_img.src = addRandomQueryToPath(`${server_endpoint}data/thumbnail.jpg`)  
    thumbnail_img.src = data.thumbnailUrl
    download_container.style.display = "flex"
    artist.innerHTML = data.artist
    song_title.innerHTML = data.songTitle
    song_duration.innerHTML = data.duration

    // window.open(`${server_endpoint}${data.song}`);
    // download_btn.href = `${server_endpoint}${data.songPath}`

    // blobNDownload()
}

async function convertSong(){
    songInfo['bitrate'] = bitrate_select.options[bitrate_select.selectedIndex].value;
    const full_url = download_endpoint+'?'+ new URLSearchParams(songInfo)

    convert_ring.style.display = "block"
    convert_btn.style.display = "none"

    console.log('converting started')
    let res = await fetch(full_url)
    let data = await res.json()
    console.log('converting ended')

    download_btn.style.display = "block"
    download_btn.href = `${server_endpoint}${data.songPath}`

    convert_ring.style.display = "none"
    console.log(data)
}

function clearDataAfterDownload(){
    url_text_input.value = ""
    download_btn.style.display = "none"
    convert_btn.style.display = "block"
}

function clearData(){
    download_btn.style.display = "none"
    download_btn.href = ""
    // download_container.style.display = "none"
    thumbnail_img.src = ''
    convert_btn.style.display = "block"
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

