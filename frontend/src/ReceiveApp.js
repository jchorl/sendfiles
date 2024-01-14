import React, { useEffect, useState } from "react";
import config from "./Config";
import { decryptMessage, importKeyFromBase64 } from "./Crypto";
import { NEW_ANSWER, NEW_OFFER, NEW_ICE_CANDIDATE } from "./Constants";
import { Receiver } from "./FileTransfer";
import { downloadFile, humanFileSize } from "./Utils";
import "./ReceiveApp.css";

function ReceiveApp() {
  const [password, setPassword] = useState("");
  const [passwordPlaceholder] = useState(
    Math.random() < 0.5 ? "hunter2" : "correct-horse-battery-staple"
  );
  const [transferDetails, setTransferDetails] = useState();
  const [fetchTransferError, setFetchTransferError] = useState();
  const [formErrors, setFormErrors] = useState();

  // turns /receive/aaa into aaa
  const currentURL = new URL(window.location.href);
  const transferId = currentURL.pathname.match(/receive\/([\w\-_]+)\/?/)[1];

  // fetch transfer details
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
      .then((resp) => {
        if (resp.status === 404) {
          throw new Error(
            "Transfer not found. This could be because the upload expired. Please ask the sender to try again."
          );
        }
        return resp;
      })
      .then((resp) => resp.json())
      .then((details) =>
        setTransferDetails({
          ...details,
          validUntil: new Date(details.validUntil),
        })
      )
      .catch((e) => {
        console.error("fetching transfer", e);
        setFetchTransferError(e);
      });
  }, [transferId]);

  // form validation
  const validateForm = () => {
    let newErrors = {};

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

  // code to receive the actual file via webrtc
  const initiateReceive = async (e) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    // open websocket to coordinate webrtc connection and transfer the file
    const socketUrl = new URL(config.COORD_API);
    socketUrl.searchParams.set("role", "receiver");
    socketUrl.searchParams.set("transfer_id", transferDetails.id);

    const socket = new WebSocket(socketUrl);
    socket.onerror = (e) => {
      setFetchTransferError({
        message: "The server could not be reached. Please try again.",
      });
    };

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

    // decrypt/download
    const privateKey = await importKeyFromBase64(transferDetails.privateKey);
    const decrypted = await decryptMessage(received, privateKey, password);
    const downloadBlob = new Blob([decrypted], { type: "text/plain" });
    downloadFile(transferDetails.fileName, downloadBlob);
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
                Encrypted content length:{" "}
                {humanFileSize(transferDetails.contentLengthBytes)}
              </div>
              <div>
                Valid until: {transferDetails.validUntil.toLocaleString()}
              </div>
            </>
          ) : !fetchTransferError ? (
            <div>Loading...</div>
          ) : null}
        </div>
        {transferDetails && (
          <>
            <div className="form-field">
              <label htmlFor="password">Enter password</label>
              <div className="form-description">
                The password will be used to decrypt your file. You will need to
                get it from the recipient yourself.
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
            <div className="form-field">
              <label htmlFor="submit">Receive</label>
              <div className="form-description">
                Clicking <code>Receive</code> will transfer the encrypted file
                from the sender. It'll then decrypt it using the password and
                download the file to your computer.
              </div>
              <button
                id="submit"
                type="submit"
                className="filled receive-button"
                onClick={initiateReceive}
              >
                Receive
              </button>
            </div>
          </>
        )}
        {fetchTransferError && (
          <div className="error-text">{fetchTransferError.message}</div>
        )}
      </form>
    </div>
  );
}

export default ReceiveApp;
