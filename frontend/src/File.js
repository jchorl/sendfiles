export async function readFile(file) {
  return new Promise((resolve, reject) => {
    let reader = new FileReader();
    reader.addEventListener("error", (error) => {
      console.error("Error reading file: ", error);
      reject(error);
    });
    reader.addEventListener("abort", (event) => {
      console.log("File reading aborted: ", event);
      reject(event);
    });

    reader.addEventListener("load", (e) => {
      console.log("FileRead.onload ", e);
      resolve(e.target.result);
    });

    reader.readAsArrayBuffer(file);
  });
}
