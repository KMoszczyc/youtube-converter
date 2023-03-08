var browser = browser || chrome;

//  host
// const server_endpoint = "https://youtube-converter.onrender.com"
// const server_endpoint = "https://ytmp3-converter.herokuapp.com"
const server_endpoint = "https://ytmp3-converter.cyclic.app/";
// const server_endpoint = "http://localhost:4000";


// endpoints
const download_endpoint = server_endpoint + "/download/";
const get_info_endpoint = server_endpoint + "/getInfo/";
const wakeup_dlp_endpoint = "https://yt-dlp-back.onrender.com/wakeup";
// const wakeup_dlp_endpoint = "http://127.0.0.1:5000/wakeup";

const get_stats_endpoint = server_endpoint + "/getStats/";
const update_stats_endpoint = server_endpoint + "/updateVisitStats/";

const submit_btn = document.getElementById("submit-btn");
const url_text_input = document.getElementById("url-text-input");

const get_info_ring = document.getElementById("get-info-ring");
const convert_ring = document.getElementById("convert-ring");

const song_start_input = document.getElementById("song-start-input");
const song_end_input = document.getElementById("song-end-input");

const convert_btn = document.getElementById("convert-btn");
const download_btn = document.getElementById("download-btn");
const thumbnail_img = document.getElementById("thumbnail_img");
const download_container = document.getElementById("download-container");

const edit_info_btn = document.getElementById("edit-info-btn");
const save_info_btn = document.getElementById("save-info-btn");

const song_title = document.getElementById("song-title");
const artist = document.getElementById("artist");
const song_duration = document.getElementById("song-duration");
const bitrate_select = document.getElementById("bitrate-select");

const visitStat = document.getElementById("visits-stat");
const convertedStat = document.getElementById("total-coversions-stat");
const timeStat = document.getElementById("total-time-stat");

const url_error_box = document.getElementById("url-error-box");
const song_cut_time_error_box = document.getElementById("song-cut-time-error-box");

const EMPTY_URL_ERROR = "You cannot send empty url!";
let songInfo = null;

window.onload = () => {
    var form = document.querySelector("form");
    form.addEventListener("submit", getSongInfo, false);
    download_btn.onclick = clearDataAfterDownload;
    convert_btn.onclick = convertSong;
    edit_info_btn.onclick = onEditInfoClicked;
    save_info_btn.onclick = onSaveInfoClicked;

    song_start_input.addEventListener("focus", hideCutTimeErrorBox);
    song_end_input.addEventListener("focus", hideCutTimeErrorBox);

    fetch(wakeup_dlp_endpoint).then(res => res.json().then(text => console.log(text)));
    fetch(update_stats_endpoint);

    updateStats()
};

/**
 * Hides wrong time error box after clicking on song start on end input fields.
 */
function hideCutTimeErrorBox() {
    song_cut_time_error_box.style.display = "none";
}

/**
 * Sends song url to backend and in response gets song info (title, thumbnail, author) and displays it onto UI
 * @param {Event} e
 */
async function getSongInfo(e) {
    e.preventDefault();

    if (url_text_input.value == "") {
        url_error_box.innerHTML = EMPTY_URL_ERROR;
        url_error_box.style.display = "inline-block";
        return;
    } else {
        url_error_box.style.display = "none";
    }

    const full_url = get_info_endpoint + "?" + new URLSearchParams({ url: url_text_input.value });

    get_info_ring.style.display = "block";
    clearData();

    let res = await fetch(full_url);
    let data = await res.json();
    songInfo = data;

    if (data.error != "") {
        url_text_input.value = "";
        url_error_box.innerHTML = data.error;
        url_error_box.style.display = "inline-block";
        get_info_ring.style.display = "none";
        return;
    }

    get_info_ring.style.display = "none";
    submit_btn.disabled = false;
    thumbnail_img.src = data.thumbnailUrl;
    download_container.style.display = "flex";
    artist.innerHTML = data.artist;
    song_title.innerHTML = data.songTitle;
    song_duration.innerHTML = secondsToISOTime(data.duration);
    song_end_input.placeholder = secondsToISOTime(data.duration);
}

/**
 * Parse provided data from user [bitrate, start and end time] and send it with rest of the song data to backend for corversion.
 */
async function convertSong() {
    songInfo["bitrate"] = bitrate_select.options[bitrate_select.selectedIndex].value;
    songInfo["start_time"] = 0;
    songInfo["end_time"] = songInfo.duration;
    songInfo["songTitle"] = song_title.textContent;
    songInfo["artist"] = artist.textContent;

    song_cut_time_error_box.style.display = "none";

    if (song_start_input.value != "") songInfo["start_time"] = ISOToSeconds(song_start_input.value);
    if (song_end_input.value != "") songInfo["end_time"] = ISOToSeconds(song_end_input.value);
    if (!(song_cut_time_error_box.style.display == "" || song_cut_time_error_box.style.display == "none")) return;

    const full_url = download_endpoint + "?" + new URLSearchParams(songInfo);

    convert_ring.style.display = "block";
    convert_btn.style.display = "none";

    //converting started
    let res = await fetch(full_url);
    let data = await res.json();
    //converting ended
    console.log(data);
    const cleaned_url = data.url.replace("\\", "");
    console.log(cleaned_url);

    download_btn.style.display = "block";

    // Uncomment if using something else than Cyclic.sh
    // download_btn.href = `${server_endpoint}/${cleaned_url}`;
    download_btn.href = cleaned_url;

    convert_ring.style.display = "none";
}

async function updateStats(){
    let res = await fetch(get_stats_endpoint);
    let data = await res.json();
    console.log(data)

    visitStat.innerHTML = data.totalVisits
    convertedStat.innerHTML = data.totalConversions
    timeStat.innerHTML = secondsToHHMMSS(data.totalSeconds)
}




/**
 * Reset UI after clicking download button.
 */
function clearDataAfterDownload() {
    url_text_input.value = "";
    download_btn.style.display = "none";
    convert_btn.style.display = "block";
    song_start_input.value = "";
    song_end_input.value = "";
}

/**
 * Reset UI right after searching for a new song.
 */
function clearData() {
    download_btn.style.display = "none";
    download_btn.href = "";
    thumbnail_img.src = "";
    convert_btn.style.display = "block";
}

function onEditInfoClicked() {
    song_title.setAttribute("contenteditable", true);
    artist.setAttribute("contenteditable", true);
    song_title.classList.add("bordered");
    artist.classList.add("bordered");
    save_info_btn.style.visibility = "visible";

    song_title.focus();
}

function onSaveInfoClicked() {
    song_title.setAttribute("contenteditable", false);
    artist.setAttribute("contenteditable", false);
    song_title.classList.remove("bordered");
    artist.classList.remove("bordered");
    save_info_btn.style.visibility = "hidden";
}

/**
 * Converts seconds to ISO format - mm:ss
 * @param {string} secondsStr
 * @returns
 */
function secondsToISOTime(secondsStr) {
    let seconds = parseInt(secondsStr);
    let timeStr = new Date(seconds * 1000).toISOString().substr(11, 8);

    if (seconds < 3600) timeStr = timeStr.substring(3, timeStr.length);
    if (seconds < 600) timeStr = timeStr.substring(1, timeStr.length);

    return timeStr;
}

function secondsToHHMMSS(secondsStr) {
    let seconds = parseInt(secondsStr);
    return (Math.floor(seconds / 3600)) + "h " + ("0" + Math.floor(seconds / 60) % 60).slice(-2) + "m " + ("0" + seconds % 60).slice(-2) + "s"
}

/**
 * Converts mm:ss time to seconds
 * @param {string} isoTime | represents time in format mm:ss
 * @returns
 */
function ISOToSeconds(isoTime) {
    let [minutes, seconds] = isoTime.split(":");

    try {
        minutes = parseInt(minutes, 10);
        seconds = parseInt(seconds, 10);

        if (isTimeCorrect(minutes) && isTimeCorrect(seconds)) {
            const time = minutes * 60 + seconds;
            if (time <= songInfo.duration) return minutes * 60 + seconds;
        }
    } catch (error) {
        console.log(error);
    }

    song_cut_time_error_box.style.display = "block";
    song_start_input.value = "";
    song_end_input.value = "";
}

/**
 * Checks if given time is in correct range [0 to 60] - applies to seconds and minutes
 * @param {int} time
 * @returns
 */
function isTimeCorrect(time) {
    return time >= 0 && time < 60;
}
