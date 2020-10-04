export class Sender {
  chunkSize = 16384;

  constructor(contents) {
    this.contents = contents;
    this.connection = new RTCPeerConnection();
    console.log("Created local peer connection object localConnection");

    this.channel = this.connection.createDataChannel("sendDataChannel");
    this.channel.binaryType = "arraybuffer";
    console.log("Created send data channel");

    // "useless" in-line lambdas because otherwise `this` gets overridden in the callback
    this.channel.addEventListener("open", () =>
      this.onSendChannelStateChange()
    );
    this.channel.addEventListener("close", () =>
      this.onSendChannelStateChange()
    );
    this.channel.addEventListener("error", (error) =>
      console.error("Error in sendChannel:", error)
    );
  }

  // TODO get rid of this lurk
  getConnection() {
    return this.connection;
  }

  addIceCandidateListener(receiver) {
    this.connection.addEventListener("icecandidate", async (event) => {
      console.log("Local ICE candidate: ", event.candidate);
      await receiver.getConnection().addIceCandidate(event.candidate);
    });
  }

  onSendChannelStateChange() {
    const readyState = this.channel.readyState;
    console.log(`Send channel state is: ${readyState}`);
    if (readyState === "open") {
      this.sendData();
    }
  }

  async createOffer() {
    try {
      const desc = await this.connection.createOffer();
      await this.connection.setLocalDescription(desc);
      console.log(`Offer from localConnection\n ${desc.sdp}`);
      return desc;
    } catch (e) {
      console.log("Failed to create session description: ", e);
    }
  }

  async registerAnswer(desc) {
    await this.connection.setRemoteDescription(desc);
  }

  sendData() {
    const { contents } = this;

    let offset = 0;
    const contentLen = contents.byteLength;
    while (offset < contentLen) {
      console.log(`send progress: ${offset}`);
      const sliceContents = contents.slice(offset, offset + this.chunkSize);
      this.channel.send(sliceContents);
      offset += sliceContents.byteLength;
    }
  }
}

export class Receiver {
  receivedSize = 0;

  fileSize;

  constructor(fileSize) {
    this.connection = new RTCPeerConnection();
    this.receiveBuffer = new Uint8Array(fileSize);

    // this is a funky interface hack that turns the registered-callback interface
    // into an async/await promise interface :(
    this.completionPromise = new Promise((resolve, reject) => {
      this.resolveCompletionPromise = resolve;
    });

    console.log("Created remote peer connection object remoteConnection");

    this.fileSize = fileSize;
    this.connection.addEventListener("datachannel", (event) =>
      this.receiveChannelCallback(event)
    );
  }

  // TODO get rid of this lurk
  getConnection() {
    return this.connection;
  }

  addIceCandidateListener(sender) {
    this.connection.addEventListener("icecandidate", async (event) => {
      console.log("Remote ICE candidate: ", event.candidate);
      await sender.getConnection().addIceCandidate(event.candidate);
    });
  }

  async answer(desc) {
    await this.connection.setRemoteDescription(desc);
    try {
      const answer = await this.connection.createAnswer();
      await this.connection.setLocalDescription(answer);
      console.log(`Answer from remoteConnection\n ${desc.sdp}`);
      return answer;
    } catch (e) {
      console.log("Failed to create session description: ", e);
    }
  }

  receiveChannelCallback(event) {
    console.log("Receive Channel Callback");
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
    const readyState = channel.readyState;
    console.log(`Receive channel state is: ${readyState}`);
  }
}
