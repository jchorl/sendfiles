import React, { useEffect, useState } from "react";
import config from "./Config";
import { decryptMessage, importKeyFromBase64 } from "./Crypto";
import { NEW_ANSWER, NEW_OFFER, NEW_ICE_CANDIDATE } from "./Constants";
import { Receiver } from "./FileTransfer";
import "./ReceiveApp.css";

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
  const [passwordPlaceholder] = useState(
    Math.random() < 0.5 ? "hunter2" : "correct-horse-battery-staple"
  );
  const [transferDetails, setTransferDetails] = useState();

  const currentURL = new URL(window.location.href);
  // turns /receive/aaa into aaa
  const transferId = currentURL.pathname.match(/receive\/([\w-]+)\/?/)[1];

  useEffect(() => {
    const params = new URLSearchParams();
    params.set("id", transferId);

    fetch(config.TRANSFER_API + "?" + params.toString(), {
      method: "GET",
      mode: "cors", // TODO make this not CORS if possible
      headers: {
        "Content-Type": "application/json",
      },
    })
      .then((resp) => resp.json())
      .then((details) =>
        setTransferDetails({
          ...details,
          validUntil: new Date(details.validUntil),
        })
      );
  }, []);

  const receive = async (e) => {
    e.preventDefault();

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
      <form>
        <div className="form-field">
          <label>File details</label>
          {transferDetails ? (
            <>
              <div>Filename: {transferDetails.fileName}</div>
              <div>
                Encrypted content length: {transferDetails.contentLengthBytes}{" "}
                bytes
              </div>
              <div>
                Valid until: {transferDetails.validUntil.toLocaleString()}
              </div>
            </>
          ) : (
            <div>Loading...</div>
          )}
        </div>
        <div className="form-field">
          <label htmlFor="password">Enter password</label>
          <div className="form-description">
            The password will be used to decrypt your file. You will need to get
            it from the recipient yourself.
          </div>
          <input
            id="password"
            type="password"
            placeholder={passwordPlaceholder}
            onChange={(e) => setPassword(e.target.value)}
            value={password}
          />
        </div>
        <div>
          <label htmlFor="submit">Receive</label>
          <div className="form-description">
            Clicking <code>Receive</code> will transfer the encrypted file from
            the sender. It'll then decrypt it using the password and download
            the file to your computer.
          </div>
          <button
            id="submit"
            type="submit"
            className="filled receive-button"
            onClick={receive}
          >
            Receive
          </button>
        </div>
      </form>
    </div>
  );
}

export default ReceiveApp;
