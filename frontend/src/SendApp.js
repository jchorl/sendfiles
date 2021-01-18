import React, { useState } from "react";
import config from "./Config";
import {
  NEW_ANSWER,
  NEW_OFFER,
  NEW_RECIPIENT,
  NEW_ICE_CANDIDATE,
} from "./Constants";
import { genKey, encryptMessage, exportKeyAsBase64 } from "./Crypto";
import { readFile } from "./File";
import { Sender } from "./FileTransfer";
import ClipboardButton from "./ClipboardButton";
import "./SendApp.css";

function getReceiverLink(id) {
  const currentURL = new URL(window.location.href);
  return `${currentURL.origin}/receive/${id}`;
}

function SendApp() {
  const [fileDetails, setFileDetails] = useState();
  const [password, setPassword] = useState("");
  const [receiveLink, setReceiveLink] = useState();
  const [passwordPlaceholder] = useState(
    Math.random() < 0.5 ? "hunter2" : "correct-horse-battery-staple"
  );
  const [formErrors, setFormErrors] = useState();

  // save files when selected
  const onFileSelected = (e) => {
    const file = e.target.files[0];
    if (!file) {
      console.log("No file chosen");
      return;
    }

    setFileDetails(file);
  };

  // form validation
  const validateForm = () => {
    let newErrors = {};

    if (!fileDetails) {
      newErrors.file_input = "At least one file must be selected";
    }

    if (!password) {
      newErrors.password = "Password cannot be empty";
    }

    if (Object.keys(newErrors).length > 0) {
      setFormErrors(newErrors);
      return false;
    }

    setFormErrors();
    return true;
  };

  // offer up the file!
  const initiateTransfer = async (e) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    // deal with keys/encryption
    const key = await genKey();
    const contents = await readFile(fileDetails);
    const encrypted = await encryptMessage(contents, key, password);
    const encodedKey = await exportKeyAsBase64(key);

    // post metadata to metadata service
    const validUntil = new Date(
      Date.now() + config.FILE_VALID_HOURS * 60 * 60 * 1000
    );
    const metadata = {
      fileName: fileDetails.name,
      contentLengthBytes: encrypted.byteLength,
      privateKey: encodedKey,
      validUntil: validUntil,
    };
    const transferDetails = await fetch(config.TRANSFER_API, {
      method: "POST",
      mode: "cors", // TODO make this not CORS if possible
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(metadata),
    }).then((resp) => resp.json());

    // set up receiver link
    const receiverLink = getReceiverLink(transferDetails.id);
    setReceiveLink(receiverLink);

    // open websocket to coordinate webrtc connection and transfer the file
    const socketUrl = new URL(config.COORD_API);
    socketUrl.searchParams.set("role", "offerer");
    socketUrl.searchParams.set("transfer_id", transferDetails.id);
    const socket = new WebSocket(socketUrl);

    const senders = new Map();

    // coordination logic for webrtc
    const senderSocketOnMessage = async (event) => {
      const { sender: senderAddress, body: rawBody } = JSON.parse(event.data);
      const body = JSON.parse(rawBody);

      switch (body.type) {
        case NEW_ANSWER: {
          const sender = senders[senderAddress];
          await sender.registerAnswer(body.answer);
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
        <div className="form-field">
          <label>How it works</label>
          <div>
            <a href="/">sendfiles.dev</a> allows you to transfer files directly
            from one browser to another without going through an intermediary
            server by utilizing{" "}
            <a
              href="https://webrtc.org/"
              target="_blank"
              rel="noopener noreferrer"
            >
              WebRTC
            </a>
            . Files are encrypted in your browser using the password you
            provide. The files are decrypted in the receiver's browser using the
            same password. Click <a href="/about">here</a> to read about the
            security properties.
          </div>
        </div>
        <div className="form-field">
          <label htmlFor="file_input">Select a file to transfer</label>
          <div className="form-description">
            Note the file will not be uploaded to a server. When you click
            submit, a unique link will be generated allowing the receiver to
            download the file directly from your browser.
          </div>
          <input
            id="file_input"
            type="file"
            className={formErrors && formErrors.file_input ? "error" : ""}
            onChange={onFileSelected}
          />
          {formErrors && formErrors.file_input && (
            <div className="form-error">{formErrors.file_input}</div>
          )}
        </div>
        <div className="form-field">
          <label htmlFor="password">Choose a password</label>
          <div className="form-description">
            The password will be used to encrypt your file. You will need to
            share it with the recipient.
          </div>
          <input
            id="password"
            type="password"
            className={formErrors && formErrors.password ? "error" : ""}
            placeholder={passwordPlaceholder}
            onChange={(e) => setPassword(e.target.value)}
            value={password}
          />
          {formErrors && formErrors.password && (
            <div className="form-error">{formErrors.password}</div>
          )}
        </div>
        {!receiveLink ? (
          <div>
            <label htmlFor="submit">Generate link</label>
            <div className="form-description">
              Clicking <code>Generate</code> will encrypt your file in your
              browser using the provided password. It'll then generate a unique
              link that you can share for users to transfer the encrypted file
              directly from your browser.
            </div>
            <button
              id="submit"
              type="submit"
              className="filled submit-button"
              onClick={initiateTransfer}
            >
              Generate
            </button>
          </div>
        ) : (
          <div>
            <label>Share</label>
            <div className="instruction-browser-open">
              You'll need to leave this window open until the file is completely
              copied to their browser.
            </div>
            <div className="form-description">
              Send the following link to the recipient, along with your
              password:
            </div>
            <div className="receive-link-container">
              <div className="receive-link">
                <a href={receiveLink} target="_blank" rel="noopener noreferrer">
                  {receiveLink}
                </a>
              </div>
              <div className="copy-button">
                <ClipboardButton content={receiveLink} />
              </div>
            </div>
          </div>
        )}
      </form>
    </div>
  );
}

export default SendApp;
