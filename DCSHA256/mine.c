#include <stdio.h>
#include <stdlib.h>
#include "sha2.h"

int mine(char data[])
{
    char converted[32*2 + 1];
    int nonce = 0;

    unsigned char t[1024];
    unsigned char hash[32];
    for(;;){
        sprintf(t, "%s%d", data, nonce);

        sha256(t, strlen(t), hash);
        if(hash[0] == 0x00 && hash[1] == 0x00 && hash[2] == 0x00){
            int j;
            for(j=0;j<32;j++) {
                sprintf(&converted[j*2], "%02X", hash[j]);
            }
            printf("%s\n", converted);
            printf("%s\n", t);
            break;
        }
        nonce++;
    }
    return nonce;
}
