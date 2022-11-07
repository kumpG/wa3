const {
    default: makeWASocket,
	MessageType, 
    MessageOptions, 
    Mimetype,
	DisconnectReason,
    useSingleFileAuthState
} =require("@adiwajshing/baileys");

const { Boom } =require("@hapi/boom");
const {state, saveState} = useSingleFileAuthState("./auth_info.json");
const path = require('path');
const fs = require('fs');
const http = require('http');
const https = require('https');

const express = require("express");
const bodyParser = require("body-parser");
const app = require("express")();
const server = require("http").createServer(app);
const io = require("socket.io")(server);
const axios = require("axios");
const port = process.env.PORT || 8000;


//fungsi suara capital 
function capital(textSound){
    const arr = textSound.split(" ");
    for (var i = 0; i < arr.length; i++) {
        arr[i] = arr[i].charAt(0).toUpperCase() + arr[i].slice(1);
    }
    const str = arr.join(" ");
    return str;

}

async function connectToWhatsApp() {
    
    const sock = makeWASocket({
        auth: state,
        printQRInTerminal: true
    });

    sock.ev.on('connection.update', (update) => {
    	//console.log(update);
        const { connection, lastDisconnect } = update;
        if(connection === 'close') {
            const shouldReconnect = (lastDisconnect.error = Boom)?.output?.statusCode !== DisconnectReason.loggedOut;
            console.log('connection closed due to ', lastDisconnect.error, ', reconnecting ', shouldReconnect);
            // reconnect if not logged out
            if(shouldReconnect) {
                connectToWhatsApp();
            }
        } else if(connection === 'open') {
            console.log('opened connection');
        }
    });

    sock.ev.on("creds.update", saveState);

    sock.ev.on("messages.upsert", async ({ messages, type }) => {
        
        //console.log(messages);
        
        if(type === "notify"){

            if(!messages[0].key.fromMe) {

                //tentukan jenis pesan berbentuk text                
                const pesan = messages[0].message.conversation;

                //tentukan jenis pesan apakah bentuk list
                const responseList = messages[0].message.listResponseMessage;
                
                //tentukan jenis pesan apakah bentuk button
                const responseButton = messages[0].message.buttonsResponseMessage;

                //tentukan jenis pesan apakah bentuk templateButtonReplyMessage
                //const responseReplyButton = messages[0].message.templateButtonReplyMessage;
                
                //nowa dari pengirim pesan sebagai id
                const noWa = messages[0].key.remoteJid;


                await sock.readMessages([messages[0].key]);

                //kecilkan semua pesan yang masuk lowercase 
                const pesanMasuk = pesan.toLowerCase();

                if(!messages[0].key.fromMe && pesanMasuk === "ping"){
                    await sock.sendMessage(noWa, {text: "Pong"},{quoted: messages[0] });
                }
                else if(!messages[0].key.fromMe && pesanMasuk === "btn") {
                    const buttons = [
                        {buttonId: "id1", buttonText: {displayText: 'Info 1!'}, type: 1},
                        {buttonId: "id2", buttonText: {displayText: 'Info 2!'}, type: 1},
                        {buttonId: "id3", buttonText: {displayText: '💵 Info 3'}, type: 1}
                    ]
                    const buttonInfo = {
                        text: "Info Warung Kopi",
                        buttons: buttons,
                        headerType: 1
                    }
                    await sock.sendMessage(noWa, buttonInfo, {quoted: messages[0]});
                    
                }
                else if(!messages[0].key.fromMe && responseButton){

                    //console.log(responseButton);
                    
                    if(responseButton.selectedButtonId == "id1"){
                        await sock.sendMessage(noWa, {
                            text:"anda memilih ID tombol ke 1"
                        });  
                    }else if(responseButton.selectedButtonId == "id2"){
                        await sock.sendMessage(noWa, {
                            text:"anda memilih ID tombol ke 2"
                        });  
                    }else if(responseButton.selectedButtonId == "id3"){
                        await sock.sendMessage(noWa, {
                            text:"anda memilih ID tombol ke 3"
                        });  
                    }
                    else{
                        await sock.sendMessage(noWa, {
                            text: "Pesan tombol invalid"
                        });
                    } 
                    
                }      
                else if(!messages[0].key.fromMe && pesanMasuk === "img") {
                    await sock.sendMessage(noWa, { 
                        image: {
                            url:"./image/KopiJahe.jpeg"
                        },
                        caption:"Ini Kopi Jahe"
                    });
                }
                else if(!messages[0].key.fromMe && pesanMasuk === "sound") {

                    textsound = capital("ini adalah pesan suara dari Robot Whastapp");

                    let API_URL = "https://texttospeech.responsivevoice.org/v1/text:synthesize?text="+textsound+"&lang=id&engine=g3&name=&pitch=0.5&rate=0.5&volume=1&key=0POmS5Y2&gender=male";
                    file = fs.createWriteStream("./sound.mp3");
                    const request = https.get(API_URL, async function(response) {
                        await response.pipe(file);
                        response.on("end",async function(){    
                            await sock.sendMessage(noWa, { 
                                audio: { 
                                    url: "sound.mp3",
                                    caption: textsound 
                                }, 
                                mimetype: 'audio/mp4'
                            });
                        });
                    });
                }
                else if(!messages[0].key.fromMe && pesanMasuk === "list") {

                    const jenismenu = [{
                            title : 'MAKANAN', 
                            rows :[
                                {
                                    title: "Nasi Goreng",
                                    rowId: '1'
                                }, 
                                {
                                    title: "Mie Goreng",
                                    rowId: '2'
                                },
                                {
                                    title: "Bakso Goreng",
                                    rowId: '3'
                                }
                            ]
                    },
                    {
                        title : 'MINUMAN', 
                        rows :[
                            {
                                title: "Kopi Jahe",
                                rowId: '4'
                            }, 
                            {
                                title: "Kopi Susu",
                                rowId: '5'
                            }
                        ]
                    }]

                    const listPesan = {
                        text: "Menu Pada Warung Kami",
                        title: "Daftar Menu",
                        buttonText: "Tampilakn Menu",
                        sections : jenismenu
                    }
                    
                    await sock.sendMessage(noWa, listPesan, {quoted: messages[0]});
                }              
                else if (!messages[0].key.fromMe && responseList){

                    //cek row id yang dipilih 
                    const pilihanlist = responseList.singleSelectReply.selectedRowId;
                    
                    if(pilihanlist == 1) {
                        await sock.sendMessage(noWa, { text: "Anda Memilih Item Makanan Nasi Goreng "});
                    }
                    else if (pilihanlist == 2) {
                        await sock.sendMessage(noWa, { text: "Anda Memilih Item Makanan Mie Goreng "});
                    }
                    else if (pilihanlist == 3) {
                        await sock.sendMessage(noWa, { text: "Anda Memilih Item Makanan Bakso Goreng "});
                    }
                    else if (pilihanlist == 4) {
                        await sock.sendMessage(noWa, { 
                            image: {
                                url:"./image/KopiJahe.jpeg"
                            },
                            caption:"Anda Memilih Item Minuman Kopi Jahe"
                        });
                    }
                    else if (pilihanlist == 5) {
                        await sock.sendMessage(noWa, { 
                            image: {
                                url:"./image/KopiSusu.jpeg"
                            },
                            caption:"Anda Memilih Item Minuman Kopi Susu"
                        });
                    }
                    else{
                        await sock.sendMessage(noWa, {text: "Pilihan Invalid!"},{quoted: messages[0] });
                    }    
                }
                else{
                    await sock.sendMessage(noWa, {text: "Saya adalah Bot!"},{quoted: messages[0] });
                }

            }

        }

    });

}
// run in main file
connectToWhatsApp()
.catch (err => console.log("unexpected error: " + err) ) // catch any errors

server.listen(port, () => {
  console.log("Server Berjalan pada Port : " + port);
});
