import { ethers } from "ethers";
import { request } from "undici";

const l2ResolverABI = [
    {
        inputs: [
            { internalType: "bytes32", name: "node", type: "bytes32" },
            { internalType: "address", name: "a", type: "address" },
        ],
        name: "setAddr",
        outputs: [],
        stateMutability: "nonpayable",
        type: "function",
    },
    {
        inputs: [
            { internalType: "bytes32", name: "node", type: "bytes32" },
            { internalType: "string", name: "newName", type: "string" },
        ],
        name: "setName",
        outputs: [],
        stateMutability: "nonpayable",
        type: "function",
    },
];

const registrarABI = [
    {
        inputs: [
            {
                components: [
                    { internalType: "string", name: "name", type: "string" },
                    { internalType: "address", name: "owner", type: "address" },
                    { internalType: "uint256", name: "duration", type: "uint256" },
                    { internalType: "address", name: "resolver", type: "address" },
                    { internalType: "bytes[]", name: "data", type: "bytes[]" },
                    { internalType: "bool", name: "reverseRecord", type: "bool" },
                ],
                internalType: "struct RegistrarController.RegisterRequest",
                name: "request",
                type: "tuple",
            },
        ],
        name: "register",
        outputs: [],
        stateMutability: "payable",
        type: "function",
    },
];

const L2ResolverAddress = "0xC6d566A56A1aFf6508b41f6c90ff131615583BCD";
const registrarAddress = "0x4cCb0BB02FCABA27e82a56646E81d8c5bC4119a5";

export async function fetchNameSuggestions(baseName: string): Promise<string[]> {
    try {
        const { statusCode, body } = await request(`https://www.base.org/api/name/${baseName}`);
        if (statusCode === 200) {
            const response = await body.json();
            // @ts-ignore
            return response.suggestion || [];
        } else {
            console.error("Error fetching suggestions:", statusCode, await body.text());
            return [];
        }
    } catch (error) {
        console.error("Error in fetchNameSuggestions:", error);
        return [];
    }
}

export function createRegisterData(baseName: string, addressId: string): string {
    const l2ResolverInterface = new ethers.Interface(l2ResolverABI);
    const registrarInterface = new ethers.Interface(registrarABI);

    const nameHash = ethers.keccak256(ethers.toUtf8Bytes(baseName));

    const setAddrData = l2ResolverInterface.encodeFunctionData("setAddr", [nameHash, addressId]);
    const setNameData = l2ResolverInterface.encodeFunctionData("setName", [nameHash, baseName]);

    const registerRequest = {
        name: baseName.replace(/\.base\.eth$/, ""),
        owner: addressId,
        duration: 31557600, // 1 year in seconds
        resolver: L2ResolverAddress,
        data: [setAddrData, setNameData],
        reverseRecord: true,
    };

    return registrarInterface.encodeFunctionData("register", [registerRequest]);
}

export async function sendRawTransaction(
    fromAddress: string,
    toAddress: string,
    data: string,
    value: bigint,
    auth_token: string
) {
    const rawTransaction = {
        network_name: "BASE",
        transaction: {
            from: fromAddress,
            to: toAddress,
            data,
            value: ethers.toBeHex(value),
        },
    };

    try {
        const { statusCode, body } = await request(
            "https://sandbox-api.okto.tech/api/v1/rawtransaction/execute",
            {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${auth_token}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(rawTransaction),
            }
        );

        if (statusCode === 200) {
            return await body.json();
        } else {
            console.error("Error in transaction:", statusCode, await body.text());
            throw new Error("Transaction failed");
        }
    } catch (error) {
        console.error("Error sending raw transaction:", error);
        throw error;
    }
}
