import crypto from 'crypto';

// Persistent RSA key for the application.
// In a production environment, this should be stored in an environment variable (e.g., PROCESS.ENV.PRIVATE_KEY).
const privateKey = `-----BEGIN RSA PRIVATE KEY-----
MIIEpAIBAAKCAQEA1MRyZBxfprhH/PfgUtstJwKTNubWb9pyPTuSRnS8x2J/DJ+5
L785UT2Q48wD2a8vAr5gFKVvq2bhnv3qPopkY+KkcKQZyGlAoDLzFzOaDRH4t0Kh
A68+FVJKRGzwUbj1lDepxB5q28ChisKHdiDUJDQGgGLFf4rG2x1lmr0MNzncW7F3
EvaR42Y2QWuzZXnNF6YN+XRisp8cVmR+NdZL6f0bNpyGsr13IIDvFyZxcKC/c0Eh
GcKn729+w2CMun30wgfN+DqtFSAj9Q3oQC6cBqpzKC8u7hkvWQ1sUJPDVJUfANay
YpFDqBzIjmUJKhPK+oOxxfFmAbt1wZd09zAqqwIDAQABAoIBAQCcagq6RA2hb+ok
M0nrP4uTGRaGju7n7cx77XZca2d4oJVL/4PRcR++9Ka2gH34IwxJVREnPHO6qviE
vJ/e+DhTIgPHdywpJA9Jdgs1bE78+tBAUTAzmDnozMUiRn/pZDLNkpowPjhKcvOP
IfEZy4qJTuHUskgEuk30OUk/l2kKkxxltTG1MWFrgAudNni6yma+sYBCBjdBikPY
TLbtcmAjpb736enn/GE8AkmMMUFJvB4WfVHsyf0UABwjNYdMQur2Jt7HE8ghfvGk
HK0lI8DugIbldkb7BVa4HiUdb0Qc7Z1mAg3hf5Qr3XzwLBJnWGoiK7UWVFiQ9p+n
mb7ICf6BAoGBAPInSnmO12s+MUBUsHEjbNEBL/hz053wmkZPcfbygrddX8hn7Afy
2kcS1eAVUAuojQeSKIwE+jCznZUqsikbjxJtsLeozoggZQWHRMz4uNCQE+/ZOSk2
GKcpR/wJFmDKA2smxKmeGx3PUJ2t6ANnMLc+9jyAONKLgBvKhuR7ULZrAoGBAODu
/nXnBZAoENP/HaTsX/aM8New64c+nOFc+b+MWTsRyw27w2gpjk2W1B5YQfIqLajp
xrGKMOdWnXOODlJwIsZVCCZfj9r8KgWakk/r0Cf1qIYM3t0Zw4i/VoHM11RKFfLv
mTHer8T2j3NyB+jVD2p07nMew+pmZYQnOsiYhOzBAoGAXLsxKPXLhtUNNU55NwpS
3ILw5NsuObhuy+gWg3QBHMkUKgGqAK0+a6NJ5gMjYSONxk1xW5V4Xfgaq4nrKhTU
qED7QInTdYu6Q/C2JyxEUhIqoFn2KtL9g94qI9kzCaOyxXDWNQJH7hV7ELcNN2hn
3nStBSQxHmevinT3TT3v/bsCgYEAs9hjPIHqwMhILDjeyu70C33FU6/xocE+TjK4
vZ7J+aDQabqnErGnRgJCt8B5edafi17frzR+xXlLiwkaCm/+XfW+/m+J5d2Y+8IL
GjvBwzF3/TZtOvtOjBfwYvgVcx+JTSSlqGoUv7ckG3ohONih6sxzmzgODWyx3mg/
aAQKxAECgYA5ssx1KCrxLedQ4whIhvf4S65G3NZNLsqVK8AlYaIvM2GdoDqLGzDa
XyoNxXsIbKM22pXTH501ufKfFAG87w3oACV3NsYU/1jb9xWhan1sdBlrLXmxXdmS
XYgaZBw8+lRrct4F7BcMhVeA23djoAhib7fRmGE+8oTuJeQR2YDj4g==
-----END RSA PRIVATE KEY-----`;

export const publicKey = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA1MRyZBxfprhH/PfgUtst
JwKTNubWb9pyPTuSRnS8x2J/DJ+5L785UT2Q48wD2a8vAr5gFKVvq2bhnv3qPopk
Y+KkcKQZyGlAoDLzFzOaDRH4t0KhA68+FVJKRGzwUbj1lDepxB5q28ChisKHdiDU
JDQGgGLFf4rG2x1lmr0MNzncW7F3EvaR42Y2QWuzZXnNF6YN+XRisp8cVmR+NdZL
6f0bNpyGsr13IIDvFyZxcKC/c0EhGcKn729+w2CMun30wgfN+DqtFSAj9Q3oQC6c
BqpzKC8u7hkvWQ1sUJPDVJUfANayYpFDqBzIjmUJKhPK+oOxxfFmAbt1wZd09zAq
qwIDAQAB
-----END PUBLIC KEY-----`;

export function encodePermissions(permissions: string[]) {
  const data = JSON.stringify(permissions);
  
  try {
    // Create a signature using the persistent private key
    const sign = crypto.createSign('SHA256');
    sign.update(data);
    const signature = sign.sign(privateKey, 'base64');
    
    // The payload contains the base64 data and the cryptographic signature
    const payload = JSON.stringify({
      data: Buffer.from(data).toString('base64'),
      signature
    });
    
    return {
      encoded: Buffer.from(payload).toString('base64'),
      publicKey
    };
  } catch (e) {
    console.error("Error signing permissions with private key:", e);
    return {
      encoded: Buffer.from(JSON.stringify({ data: Buffer.from(data).toString('base64'), signature: "" })).toString('base64'),
      publicKey
    };
  }
}
