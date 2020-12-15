import React from "react";
import "./AboutApp.css";

function AboutApp() {
  return (
    <div>
      <div className="form-field">
        <label>Architecture</label>
        <div className="subsection">
          <a href="/">sendfiles.dev</a> has two components - a transfer metadata
          store and{" "}
          <a
            href="https://webrtc.org"
            target="_blank"
            rel="noopener noreferrer"
          >
            WebRTC
          </a>{" "}
          signalling/coordination. Each component has an{" "}
          <a
            href="https://aws.amazon.com/api-gateway/"
            target="_blank"
            rel="noopener noreferrer"
          >
            API Gateway
          </a>
          , a{" "}
          <a
            href="https://aws.amazon.com/lambda/"
            target="_blank"
            rel="noopener noreferrer"
          >
            Lambda
          </a>{" "}
          function and a{" "}
          <a
            href="https://aws.amazon.com/dynamodb/"
            target="_blank"
            rel="noopener noreferrer"
          >
            DynamoDB
          </a>{" "}
          database.
        </div>
        <div className="subsection">
          Transfers:
          <ul>
            <li>
              <code>Transfers DynamoDB</code> - stores metadata (filename, size,
              keys) for transfers, but <span className="bold">not</span> the
              file contents
            </li>
            <li>
              <code>Transfers Lambda</code> - simple API wrapper around{" "}
              <code>Transfers DynamoDB</code>
            </li>
            <li>
              <code>Transfers API Gateway</code> - HTTP gateway sitting in front
              of <code>Transfers Lambda</code>
            </li>
          </ul>
          Coordination:
          <ul>
            <li>
              <code>Sessions DynamoDB</code> - stores API Gateway websocket IDs
              of senders/receivers so they can communicate with each other
            </li>
            <li>
              <code>Coord Lambda</code> - allows sender/receiver to communicate
              in order to set up{" "}
              <a
                href="https://webrtc.org"
                target="_blank"
                rel="noopener noreferrer"
              >
                WebRTC
              </a>{" "}
              connections
            </li>
            <li>
              <code>Coord API Gateway</code> - Websocket gateway sitting in
              front of <code>Coord Lambda</code>, keeping websockets open
            </li>
          </ul>
        </div>
      </div>
      <a href="/architecture.png" target="_blank">
        <img
          className="arch-img"
          src="/architecture.png"
          alt="architecture diagram"
        />
      </a>
      <div className="form-field">
        <label>Security</label>
        <div className="subsection">
          For an attacker to gain access to the plaintext contents, they would
          need the symmetric encryption key <code>k</code>, the passphrase{" "}
          <code>p</code> and the encrypted blob.
          <ul>
            <li>
              Passphrase <code>p</code> should be securely shared outside the
              app. Without this, an attacker cannot gain access to the plaintext
              contents.
            </li>
            <li>
              Encrypted contents are streamed from browser to browser using{" "}
              <a
                href="https://webrtc.org"
                target="_blank"
                rel="noopener noreferrer"
              >
                WebRTC
              </a>
              . You can read about WebRTC security{" "}
              <a
                href="https://webrtc-security.github.io/"
                target="_blank"
                rel="noopener noreferrer"
              >
                here
              </a>
              .
            </li>
            <li>
              Key <code>k</code> is stored in an untrusted database with an
              expiration time of one hour. This key is not useful without
              passphrase <code>p</code>.
            </li>
          </ul>
        </div>
      </div>
      <div className="form-field">
        <label>Encryption/Decryption</label>
        <div className="subsection">
          All encryption/decryption/key generation happens in the browser using{" "}
          <a
            href="https://developer.mozilla.org/en-US/docs/Web/API/Web_Crypto_API"
            target="_blank"
            rel="noopener noreferrer"
          >
            Web Crypto
          </a>
          .
        </div>
        <div className="subsection">
          When the sender clicks send:
          <ol>
            <li>
              A new symmetric key <code>k</code> with passphrase <code>p</code>{" "}
              is generated using Web Crypto's{" "}
              <a
                href="https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/generateKey"
                target="_blank"
                rel="noopener noreferrer"
              >
                generateKey
              </a>{" "}
              (AES-GCM)
            </li>
            <li>
              The file is encrypted using key <code>k</code> in the sender's
              browser with Web Crypto's{" "}
              <a
                href="https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/encrypt"
                target="_blank"
                rel="noopener noreferrer"
              >
                encrypt
              </a>
            </li>
            <li>
              Key <code>k</code> is exported using Web Crypto's{" "}
              <a
                href="https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/exportKey"
                target="_blank"
                rel="noopener noreferrer"
              >
                exportKey
              </a>
            </li>
            <li>
              Exported and base64-encoded key <code>k</code> is stored on the
              server (<span class="bold">without</span> passphrase{" "}
              <code>p</code>) for the receiver to retrieve
            </li>
          </ol>
        </div>
        <div className="subsection">
          When the receiver clicks receive:
          <ol>
            <li>
              The receiving browser fetches key <code>k</code> from the server
            </li>
            <li>
              After base64-decoding, key <code>k</code> is imported using Web
              Crypto's{" "}
              <a
                href="https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/importKey"
                target="_blank"
                rel="noopener noreferrer"
              >
                importKey
              </a>
            </li>
            <li>
              The encrypted blob is decrypted using key <code>k</code> and
              passphrase <code>p</code> (shared outside the app)
            </li>
          </ol>
        </div>
      </div>
      <div className="form-field">
        <label>Expiration</label>
        <div className="subsection">
          All transfer records (and the associated symmetric keys) are stored
          for one hour (expired using{" "}
          <a
            href="https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/TTL.html"
            target="_blank"
            rel="noopener noreferrer"
          >
            DynamoDB TTLs
          </a>
          ). After this time period, the decryption key will be deleted,
          rendering the encrypted blob useless.
        </div>
      </div>
      <div className="form-field">
        <label>Why WebRTC?</label>
        <div className="subsection">
          <ul>
            <li>
              It eliminates the need to store contents (encrypted or
              unencrypted) on a trusted third party server. As soon as the
              sender closes their browser window, the contents cannot be
              accessed.
            </li>
            <li>
              Hosting is ~free and is independent of the size of files
              transferred.
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}

export default AboutApp;
