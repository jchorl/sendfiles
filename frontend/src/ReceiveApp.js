import React, { useState } from "react";
import config from "./Config.js";
import { decryptMessage, importKeyFromBase64 } from "./Crypto.js";
import { NEW_ANSWER, NEW_OFFER, NEW_ICE_CANDIDATE } from "./Constants.js";
import { Receiver } from "./FileTransfer.js";

function download(filename, blob) {
  const downloadLink = URL.createObjectURL(blob);

  const element = document.createElement("a");
  element.setAttribute("href", downloadLink);
  element.setAttribute("download", filename);

  element.style.display = "none";
  document.body.appendChild(element);

  element.click();

  document.body.removeChild(element);
}

function ReceiveApp() {
  const [password, setPassword] = useState("");

  const receive = async (e) => {
    e.preventDefault();

    const currentURL = new URL(window.location.href);
    // turns /receive/aaa into aaa
    const transferId = currentURL.pathname.match(/receive\/([\w-]+)\/?/)[1];

    const params = new URLSearchParams();
    params.set("id", transferId);

    const transferDetails = await fetch(
      config.TRANSFER_API + "?" + params.toString(),
      {
        method: "GET",
        mode: "cors", // TODO make this not CORS if possible
        headers: {
          "Content-Type": "application/json",
        },
      }
    ).then((resp) => resp.json());

    const socketUrl = new URL(config.COORD_API);
    socketUrl.searchParams.set("role", "receiver");
    socketUrl.searchParams.set("transfer_id", transferDetails.id);
    const socket = new WebSocket(socketUrl);

    const receiver = new Receiver(socket, transferDetails.contentLengthBytes);
    socket.onmessage = async function (event) {
      const { sender: senderAddress, body: rawBody } = JSON.parse(event.data);
      const body = JSON.parse(rawBody);

      switch (body.type) {
        case NEW_OFFER: {
          const answer = await receiver.answer(body.offer);
          const resp = { type: NEW_ANSWER, answer };
          receiver.setRecipientAddress(senderAddress);
          receiver.sendMessage(resp);
          receiver.registerIceCandidateListener();
          break;
        }
        case NEW_ICE_CANDIDATE: {
          const candidate = new RTCIceCandidate(body.candidate);
          receiver.addIceCandidate(candidate);
          break;
        }
        default:
          throw new Error(`Unsupported message type ${body.type}`);
      }
    };

    const received = await receiver.completionPromise;
    const privateKey = await importKeyFromBase64(transferDetails.privateKey);
    const decrypted = await decryptMessage(received, privateKey, password);
    const downloadBlob = new Blob([decrypted], { type: "text/plain" });
    download(transferDetails.fileName, downloadBlob);
  };

  return (
    <div>
      Receive App
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
          <button id="submit" type="submit" onClick={receive}>
            Receive
          </button>
        </div>
      </form>
    </div>
  );
}

export default ReceiveApp;
