const fs = require('fs');
const fsExtra = require('fs-extra')
const ytdl = require('ytdl-core');
const NodeID3 = require('node-id3')
const download = require('image-downloader')
const ffmpeg = require('ffmpeg-static');
const cp = require('child_process');

String.prototype.replaceAll = function replaceAll(search, replace) { return this.split(search).join(replace); }
const dirPath= 'data/'

async function getInfo(url){
    const usefullPart = url.split('&list=')[0]
    let [_, videoID] = usefullPart.split('?v=')

    // if it's copied link from youtube mobile app
    if(!videoID)
        videoID = usefullPart.split('youtu.be/')[1]

    let info = null
    try {
        info = await ytdl.getBasicInfo(videoID);
    }
    catch(err){
        console.log(err)
        return {error: "Video with that url doesn't exist!"}
    }

    // console.log(info.videoDetails);
    let thumbnailUrl = info.videoDetails.thumbnails[info.videoDetails.thumbnails.length - 2].url.split('?')[0];
    const fullTitle =  info.videoDetails.title;

    console.log(thumbnailUrl)

    let [artist, songTitle] = fullTitle.split(' - ')
    if (songTitle == null){
        songTitle = artist
        artist = info.videoDetails.author.name.replace(' - Topic', '');
    }

    // removes parentheses and square brackets
    songTitle = songTitle.replace(/ *\([^)]*\) */g, "").replace(/ *\[[^\]]*]/g, '');;
    let songPath =`${artist}-${songTitle}`
    songPath = dirPath + clearText(songPath).replaceAll(' ', '_') + '.mp3'

    return {artist, songTitle, fullTitle, songPath, thumbnailUrl, songUrl: url, duration: secondsToTime(info.videoDetails.lengthSeconds), error: ""}
}

function clearText(text) {
	const source = typeof text === 'string' || text instanceof String ? text : '';
	return source.replace(/[[/\]{}()*+?.,\\^$|#\"]/g, '');
}

async function downloadThumbnail(thumbnailUrl){
    console.log('Thumbnail download started')

    const options = {
        url: thumbnailUrl,
        dest: dirPath+'thumbnail.jpg'               
    }

    const filenameOB = await download.image(options)
    console.log('Thumbnail downloaded')  
    return filenameOB.filename
}

function setTags(image_path, info){
    console.log('Setting tags')
    const tags = {
        title: info.songTitle,
        artist: info.artist,
        APIC: image_path,
    }
    
    NodeID3.write(tags, info.songPath, (err) => console.log(err))
    console.log('Tags are set')
}

const convertWebmToMp3 = (songPath, bitrate) => { 
    return new Promise((resolve, reject) => {
        console.log('conversion started!')
        const ffmpegProcess =  cp.spawn(ffmpeg, [
            '-i',
            dirPath+'ytsong.webm',
            // '-acodec',
            // 'libmp3lame', 
            '-b:a',
            bitrate,
            songPath
        ]);

        ffmpegProcess.on('close', () => {
            console.log('conversion done');
            resolve()
        });
    });
}

async function downloadSong(info, res){
    clearData();
    console.log(info)
    ytdl(info.songUrl, { quality: 'highestaudio' }).pipe(fs.createWriteStream(dirPath+'ytsong.webm')).on("finish", () => {
        console.log("Song download finished!");
        preprocessSong(info)
            .then((info) => {
                console.log('info', info.songPath)
                console.log(fs.existsSync(info.songPath))

                res.set({
                    // 'Content-disposition': 'attachment; filename=' + filename,
                    "Access-Control-Allow-Origin": "*",
                    // "Content-Type": "application/force-download",
                })
                // res.setHeader("Access-Control-Allow-Origin", "*")
                // "Content-Type": "application/force-download"
                // fs.createReadStream(songPath).pipe(res);
                res.json(info)
            })
    });
}

async function preprocessSong(info){
    await convertWebmToMp3(info.songPath, info.bitrate);
    // fs.renameSync('ytsong.mp3', 'renamed.mp3');

    const imagePath = await downloadThumbnail(info.thumbnailUrl);
    setTags(imagePath, info)
    console.log(info.songPath);
    return info
}

function clearData(){
    fsExtra.emptyDirSync(dirPath)
}

function secondsToTime(secondsStr) {
    let seconds = parseInt(secondsStr)
    let timeStr = new Date(seconds * 1000).toISOString().substr(11, 8);
    if (seconds < 3600) 
        timeStr = timeStr.substring(3, timeStr.length);

    if (seconds < 600) 
        timeStr = timeStr.substring(1, timeStr.length);

    return timeStr;
}

module.exports = {
    downloadSong: downloadSong,
    getInfo: getInfo
}