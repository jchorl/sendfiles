import React from "react";
import config from "./Config.js";
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
  const receive = async (e) => {
    e.preventDefault();

    const currentURL = new URL(window.location.href);
    // turns /receive/aaa into aaa
    const transferId = currentURL.pathname.match(/receive\/([\w-]+)\/?/)[1];

    const params = new URLSearchParams();
    params.set("id", transferId);

    const transferDetails = await fetch(
      config.TRANSFER_API + "/transfer?" + params.toString(),
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

    let receiver = new Receiver(socket, transferDetails.contentLengthBytes);
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
      }
    };
  };

  return (
    <div>
      Receive App
      <button id="submit" type="submit" onClick={receive}>
        Receive
      </button>
    </div>
  );
}

export default ReceiveApp;
