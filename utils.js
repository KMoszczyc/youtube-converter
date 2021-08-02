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
    const [_, videoID] = usefullPart.split('?v=')

    // if it's copied link from youtube mobile app
    if(!videoID)
        videoID = usefullPart.split('youtu.be/')[1]

    let info = await ytdl.getBasicInfo(videoID);
    // console.log(info.videoDetails);
    let thumbnailUrl = info.videoDetails.thumbnails[info.videoDetails.thumbnails.length - 2].url.split('?')[0];
    const yt_title =  info.videoDetails.title;

    console.log(thumbnailUrl)

    let [artist, songTitle] = yt_title.split(' - ')
    if (songTitle == null){
        songTitle = artist
        artist = info.videoDetails.author.name;
    }

    songTitle = songTitle.replace(/ *\([^)]*\) */g, "");
    let songPath =`${artist}-${songTitle}.mp3`
    songPath = dirPath + songPath.replaceAll(' ', '_').replaceAll('/','').replaceAll('\"', '')

    return {artist, songTitle, fullTitle: yt_title, songPath: songPath, thumbnailUrl: thumbnailUrl}
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

const convertWebmToMp3 = (songPath) => { 
    return new Promise((resolve, reject) => {
        console.log('conversion started!')
        const ffmpegProcess =  cp.spawn(ffmpeg, [
            '-i',
            dirPath+'ytsong.webm',
            '-acodec',
            'libmp3lame', 
            songPath
        ]);

        ffmpegProcess.on('close', () => {
            console.log('conversion done');
            resolve()
        });
    });
}

async function downloadSong(url, res){
    clearData();
    
    ytdl(url, { quality: 'highestaudio' }).pipe(fs.createWriteStream(dirPath+'ytsong.webm')).on("finish", () => {
        console.log("Song download finished!");
        preprocessSong(url)
            .then((songPath) => {
                console.log('song', songPath)
                console.log(fs.existsSync(songPath))

                const filename = 'song.mp3'
                res.set({
                    // 'Content-disposition': 'attachment; filename=' + filename,
                    "Access-Control-Allow-Origin": "*",
                    // "Content-Type": "application/force-download",
                    // 'Content-Length': stats.size + 5000000
                })
                // res.setHeader("Access-Control-Allow-Origin", "*")
                // "Content-Type": "application/force-download"
                // fs.createReadStream(songPath).pipe(res);
                res.json({song:songPath})
            })
    });
}

async function preprocessSong(url){
    const info = await getInfo(url);
    console.log('info:', info)
    
    await convertWebmToMp3(info.songPath);
    // fs.renameSync('ytsong.mp3', 'renamed.mp3');

    const imagePath = await downloadThumbnail(info.thumbnailUrl);
    setTags(imagePath, info)
    console.log(info.songPath);
    return info.songPath
}

function clearData(){
    fsExtra.emptyDirSync(dirPath)
}


module.exports = {
    downloadSong: downloadSong
}