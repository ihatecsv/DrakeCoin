#include <stdio.h>
#include <stdlib.h>
#include "sha2.h"

int main()
{
    char converted[32*2 + 1];
    int nonce = 0;
    int i;

    unsigned char t[100];
    unsigned char hash[32];
    for(;;){
        sprintf(t, "%s%d", "Drake", nonce);

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
    return 0;
}
