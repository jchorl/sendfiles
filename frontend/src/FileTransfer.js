import config from "./Config.js";
import { NEW_ICE_CANDIDATE } from "./Constants.js";

class Client {
  constructor(socket) {
    this.socket = socket;

    const configuration = { iceServers: [{ urls: config.STUN_SERVER }] };
    this.connection = new RTCPeerConnection(configuration);
    this.registerIceCandidateListener();
  }

  registerIceCandidateListener() {
    this.connection.addEventListener("icecandidate", (event) => {
      if (event.candidate) {
        this.sendMessage({
          type: NEW_ICE_CANDIDATE,
          candidate: event.candidate,
        });
      }
    });
  }

  addIceCandidate(candidate) {
    this.connection
      .addIceCandidate(candidate)
      .catch((e) => console.error("adding ice candidate", e));
  }

  setRecipientAddress(addr) {
    this.recipientAddr = addr;
  }

  sendMessage(message) {
    const body = {
      action: "SEND_MESSAGE",
      recipient: this.recipientAddr,
      body: JSON.stringify(message),
    };
    const encoded = JSON.stringify(body);
    this.socket.send(encoded);
  }
}

export class Sender extends Client {
  chunkSize = 16 * 1024;

  constructor(socket, contents) {
    super(socket);

    this.contents = contents;

    this.channel = this.connection.createDataChannel("sendDataChannel");
    this.channel.binaryType = "arraybuffer";

    // "useless" in-line lambdas because otherwise `this` gets overridden in the callback
    this.channel.addEventListener("open", () =>
      this.onSendChannelStateChange(),
    );
    this.channel.addEventListener("close", () =>
      this.onSendChannelStateChange(),
    );
    this.channel.addEventListener("error", (error) =>
      console.error("Error in sendChannel:", error),
    );
  }

  onSendChannelStateChange() {
    const readyState = this.channel.readyState;
    if (readyState === "open") {
      this.sendData();
    }
  }

  async createOffer() {
    try {
      const desc = await this.connection.createOffer();
      await this.connection.setLocalDescription(desc);
      return desc;
    } catch (e) {
      console.error("Failed to create session description: ", e);
    }
  }

  async registerAnswer(desc) {
    await this.connection.setRemoteDescription(desc);
  }

  sendData() {
    let offset = 0;
    const contentLen = this.contents.byteLength;

    // https://developer.mozilla.org/en-US/docs/Web/API/WebRTC_API/Using_data_channels#understanding_message_size_limits
    const bufferUpTo = 16 * 1024;
    if (this.chunkSize > bufferUpTo) {
      throw new Error(
        `Chunk size ${this.chunkSize} cannot be greater than buffer size ${bufferUpTo}`,
      );
    }

    const fillBuffer = () => {
      while (offset < contentLen && this.channel.bufferedAmount < bufferUpTo) {
        const sliceContents = this.contents.slice(
          offset,
          offset + this.chunkSize,
        );
        this.channel.send(sliceContents);
        offset += sliceContents.byteLength;
      }
    };
    this.channel.bufferedAmountLowThreshold = bufferUpTo / 2;
    this.channel.onbufferedamountlow = fillBuffer;
    fillBuffer();
  }
}

export class Receiver extends Client {
  receivedSize = 0;

  constructor(socket, fileSize) {
    super(socket);

    this.receiveBuffer = new Uint8Array(fileSize);

    // this is a funky interface hack that turns the registered-callback interface
    // into an async/await promise interface :(
    this.completionPromise = new Promise((resolve, reject) => {
      this.resolveCompletionPromise = resolve;
    });

    this.fileSize = fileSize;
    this.connection.addEventListener("datachannel", (event) =>
      this.receiveChannelCallback(event),
    );
  }

  async answer(desc) {
    await this.connection.setRemoteDescription(desc);
    try {
      const answer = await this.connection.createAnswer();
      await this.connection.setLocalDescription(answer);
      return answer;
    } catch (e) {
      console.error("Failed to create session description: ", e);
    }
  }

  receiveChannelCallback(event) {
    const receiveChannel = event.channel;
    receiveChannel.binaryType = "arraybuffer";
    receiveChannel.onmessage = (event) => this.onReceiveMessageCallback(event);
    receiveChannel.onopen = () =>
      this.onReceiveChannelStateChange(receiveChannel);
    receiveChannel.onclose = () =>
      this.onReceiveChannelStateChange(receiveChannel);
  }

  onReceiveMessageCallback(event) {
    this.receiveBuffer.set(new Uint8Array(event.data), this.receivedSize);
    this.receivedSize += event.data.byteLength;

    console.log(`Received progress: ${this.receivedSize}`);

    // we are assuming that our signaling protocol told
    // about the expected file size (and name, hash, etc).
    if (this.receivedSize === this.fileSize) {
      this.resolveCompletionPromise(this.receiveBuffer);
      console.log("TODO close channels");
    }
  }

  async onReceiveChannelStateChange(channel) {
    console.log(`channel readyState: ${channel.readyState}`);
  }
}
