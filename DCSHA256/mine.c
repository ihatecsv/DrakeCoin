#include <stdio.h>
#include <stdlib.h>
#include "sha2.h"

//Thanks https://stackoverflow.com/a/17261928
//-------------------------------------------------
int char2int(char input)
{
  if(input >= '0' && input <= '9')
    return input - '0';
  if(input >= 'A' && input <= 'F')
    return input - 'A' + 10;
  if(input >= 'a' && input <= 'f')
    return input - 'a' + 10;
}
// This function assumes src to be a zero terminated sanitized string with
// an even number of [0-9a-f] characters, and target to be sufficiently large
void hex2bin(const char* src, char* target)
{
  while(*src && src[1])
  {
    *(target++) = char2int(*src)*16 + char2int(src[1]);
    src += 2;
  }
}
//-------------------------------------------------

int main(int argc, char *argv[])
{
    char converted[32*2 + 1];
    int nonce = 0;
    unsigned char t[1024];
    unsigned char target[32];
    hex2bin(argv[1], target);
    unsigned char hash[32];
    do{
        nonce++;
        sprintf(t, "%s%d", argv[2], nonce);
        sha256(t, strlen(t), hash);
    //}while(nonce < 1000000);
    }while(memcmp(hash, target, 32) > 0);
    int j;
    for(j=0;j<32;j++) {
        sprintf(&converted[j*2], "%02X", hash[j]);
    }
    printf("%d\n", nonce);
    return 0;
}
