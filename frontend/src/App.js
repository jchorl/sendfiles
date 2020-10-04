import React, { useState } from 'react';
import { Sender, Receiver } from './FileTransfer.js';
import './App.css';

function App() {
  const [fileDetails, setFileDetails] = useState();

  const onFileSelected = e => {
    const file = e.target.files[0];
    if (!file) {
      console.log('No file chosen');
      return;
    }

    setFileDetails(file);
  }

  const submit = async e => {
    e.preventDefault();

    const sender = new Sender(fileDetails);
    const receiver = new Receiver(fileDetails.size);
    sender.addIceCandidateListener(receiver);
    receiver.addIceCandidateListener(sender);
    const offer = await sender.createOffer();
    const answer = await receiver.answer(offer);
    await sender.registerAnswer(answer);
  }

  return (
    <div>
      <header>
        Secure Send
      </header>
      <form>
        <div>
          <label htmlFor="file_input" className="file-select-label">Select a file to transfer</label>
          <input id="file_input" type="file" onChange={onFileSelected} />
        </div>
        <div>
          <button id="submit" type="submit" onClick={submit}>Submit</button>
        </div>
      </form>
    {
      fileDetails && (
      <div>
      Filename: { fileDetails.name }
      </div>
      )
    }
    </div>
  );
}

export default App;
