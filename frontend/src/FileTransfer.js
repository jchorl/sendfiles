export class Sender {
  chunkSize = 16384;

  constructor(file) {
    this.file = file;
    this.connection = new RTCPeerConnection();
    console.log('Created local peer connection object localConnection');

    this.channel = this.connection.createDataChannel('sendDataChannel');
    this.channel.binaryType = 'arraybuffer';
    console.log('Created send data channel');

    // "useless" in-line lambdas because otherwise `this` gets overridden in the callback
    this.channel.addEventListener('open', () => this.onSendChannelStateChange());
    this.channel.addEventListener('close', () => this.onSendChannelStateChange());
    this.channel.addEventListener('error', error => console.error('Error in sendChannel:', error));
  }

  // TODO get rid of this lurk
  getConnection() {
    return this.connection;
  }

  addIceCandidateListener(receiver) {
    this.connection.addEventListener('icecandidate', async event => {
      console.log('Local ICE candidate: ', event.candidate);
      await receiver.getConnection().addIceCandidate(event.candidate);
    });
  }

  onSendChannelStateChange() {
    const readyState = this.channel.readyState;
    console.log(`Send channel state is: ${readyState}`);
    if (readyState === 'open') {
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
      console.log('Failed to create session description: ', e);
    }
  }

  async registerAnswer(desc) {
    await this.connection.setRemoteDescription(desc);
  }

  sendData() {
    const {file} = this;
    console.log(`File is ${[file.name, file.size, file.type, file.lastModified].join(' ')}`);

    // Handle 0 size files.
    if (file.size === 0) {
      throw new Error(`File ${file.name} is empty, please select a non-empty file. ALSO TODO closeChannelAndConn`);
    }

    this.fileReader = new FileReader();
    let offset = 0;
    this.fileReader.addEventListener('error', error => console.error('Error reading file:', error));
    this.fileReader.addEventListener('abort', event => console.log('File reading aborted:', event));
    this.fileReader.addEventListener('load', e => {
      console.log('FileRead.onload ', e);
      this.channel.send(e.target.result);
      offset += e.target.result.byteLength;
      console.log(`send progress: ${offset}`);
      if (offset < file.size) {
        this.readSlice(offset);
      }
    });

    this.readSlice(0);
  }

  readSlice(offset) {
    console.log('readSlice ', offset);
    const slice = this.file.slice(offset, offset + this.chunkSize);
    this.fileReader.readAsArrayBuffer(slice);
  }
}

export class Receiver {
  receiveBuffer = [];
  receivedSize = 0;

  fileSize;

  constructor(fileSize) {
    this.connection = new RTCPeerConnection();
    console.log('Created remote peer connection object remoteConnection');

    this.fileSize = fileSize;
    this.connection.addEventListener('datachannel', event => this.receiveChannelCallback(event));
  }

  // TODO get rid of this lurk
  getConnection() {
    return this.connection;
  }

  addIceCandidateListener(sender) {
    this.connection.addEventListener('icecandidate', async event => {
      console.log('Remote ICE candidate: ', event.candidate);
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
      console.log('Failed to create session description: ', e);
    }
  }

  receiveChannelCallback(event) {
    console.log('Receive Channel Callback');
    const receiveChannel = event.channel;
    receiveChannel.binaryType = 'arraybuffer';
    receiveChannel.onmessage = event => this.onReceiveMessageCallback(event);
    receiveChannel.onopen = () => this.onReceiveChannelStateChange();
    receiveChannel.onclose = () => this.onReceiveChannelStateChange();
  }

  onReceiveMessageCallback(event) {
    console.log(`Received Message ${event.data.byteLength}`);
    this.receiveBuffer.push(event.data);
    this.receivedSize += event.data.byteLength;

    console.log(`Received progress: ${this.receivedSize}`);

    // we are assuming that our signaling protocol told
    // about the expected file size (and name, hash, etc).
    if (this.receivedSize === this.fileSize) {
      const received = new Blob(this.receiveBuffer);
      this.receiveBuffer = [];

      const downloadLink = URL.createObjectURL(received);
      console.log(`Could now download at ${downloadLink}`);
      console.log('TODO close channels');
    }
  }

  async onReceiveChannelStateChange() {
    const readyState = this.channel.readyState;
    console.log(`Receive channel state is: ${readyState}`);
  }
}
