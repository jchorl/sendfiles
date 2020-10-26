import React, { useState } from "react";
import config from "./Config.js";
import {
  NEW_ANSWER,
  NEW_OFFER,
  NEW_RECIPIENT,
  NEW_ICE_CANDIDATE,
} from "./Constants.js";
import { genKey, encryptMessage, exportKeyAsBase64 } from "./Crypto.js";
import { readFile } from "./File.js";
import { Sender } from "./FileTransfer.js";
import "./App.css";

function getReceiverLink(id) {
  const currentURL = new URL(window.location.href);
  return `${currentURL.origin}/receive/${id}`;
}

function SendApp() {
  const [password, setPassword] = useState("");
  const [fileDetails, setFileDetails] = useState();
  const [receiveLink, setReceiveLink] = useState("");

  const onFileSelected = (e) => {
    const file = e.target.files[0];
    if (!file) {
      console.log("No file chosen");
      return;
    }

    setFileDetails(file);
  };

  const sender = async (e) => {
    e.preventDefault();

    const key = await genKey();
    const contents = await readFile(fileDetails);
    const encrypted = await encryptMessage(contents, key, password);

    // first, post metadata
    const validUntil = new Date(
      Date.now() + config.FILE_VALID_HOURS * 60 * 60 * 1000
    );
    const encodedKey = await exportKeyAsBase64(key);
    const metadata = {
      fileName: fileDetails.name,
      contentLengthBytes: encrypted.byteLength,
      privateKey: encodedKey,
      validUntil: validUntil,
    };

    const transferDetails = await fetch(config.TRANSFER_API + "/transfer", {
      method: "POST",
      mode: "cors", // TODO make this not CORS if possible
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(metadata),
    }).then((resp) => resp.json());

    const receiverLink = getReceiverLink(transferDetails.id);
    setReceiveLink(receiverLink);

    const socketUrl = new URL(config.COORD_API);
    socketUrl.searchParams.set("role", "offerer");
    socketUrl.searchParams.set("transfer_id", transferDetails.id);
    const socket = new WebSocket(socketUrl);

    const senders = new Map();
    const senderSocketOnMessage = async (event) => {
      const { sender: senderAddress, body: rawBody } = JSON.parse(event.data);
      const body = JSON.parse(rawBody);

      switch (body.type) {
        case NEW_ANSWER: {
          const sender = senders[senderAddress];
          await sender.registerAnswer(body.answer);
          sender.registerIceCandidateListener();
          break;
        }
        case NEW_ICE_CANDIDATE: {
          const sender = senders[senderAddress];
          const candidate = new RTCIceCandidate(body.candidate);
          sender.addIceCandidate(candidate);
          break;
        }
        default:
          throw new Error(`Unsupported message type ${body.type}`);
      }
    };

    socket.onmessage = async function (event) {
      const { sender: senderAddress, body: rawBody } = JSON.parse(event.data);
      const body = JSON.parse(rawBody);

      switch (body.type) {
        case NEW_RECIPIENT: {
          const senderSocketUrl = new URL(config.COORD_API);
          senderSocketUrl.searchParams.set("role", "sender");
          senderSocketUrl.searchParams.set("transfer_id", transferDetails.id);
          const senderSocket = new WebSocket(senderSocketUrl);
          senderSocket.onmessage = senderSocketOnMessage;

          // need to wait for the socket to open
          await new Promise((resolve, reject) => {
            senderSocket.onopen = resolve;
          });

          const sender = new Sender(senderSocket, encrypted);
          sender.setRecipientAddress(senderAddress);
          senders[senderAddress] = sender;

          const offer = await sender.createOffer();
          const resp = { type: NEW_OFFER, offer };
          sender.sendMessage(resp);
          break;
        }
        default:
          throw new Error(`Unsupported message type ${body.type}`);
      }
    };
  };

  return (
    <div>
      <form>
        <div>
          <label htmlFor="password" className="file-select-label">
            Enter password
          </label>
          <input
            id="password"
            type="password"
            onChange={(e) => setPassword(e.target.value)}
            value={password}
          />
        </div>
        <div>
          <label htmlFor="file_input" className="file-select-label">
            Select a file to transfer
          </label>
          <input id="file_input" type="file" onChange={onFileSelected} />
        </div>
        <div>
          <button id="submit" type="submit" onClick={sender}>
            Submit
          </button>
        </div>
      </form>
      {receiveLink && <div>Receiver link: {receiveLink}</div>}
    </div>
  );
}

export default SendApp;
