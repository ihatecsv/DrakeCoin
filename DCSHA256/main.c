#include <stdio.h>
#include <stdlib.h>
#include "sha2.h"

int main()
{
    int i;
    for(i=0;i<2;i++){
        const unsigned char* t = "Drake";

        unsigned char hash1[32];
        sha256(t, 5, hash1);
        char converted[32*2 + 1];

        int j;
        for(j=0;j<32;j++) {
            sprintf(&converted[j*2], "%02X", hash1[j]);
        }
        printf("%s\n", converted);
    }
    return 0;
}
