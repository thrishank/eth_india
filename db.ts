import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function db() {
    try {
        const x = await prisma.userAuth.findMany();
        const y = await prisma.userState.findMany();

        console.log(x.length, y.length);
        await prisma.userAuth.deleteMany();
        await prisma.userState.deleteMany();
        await prisma.token.deleteMany();
        
    } catch (error) {
        console.error("Error in database operation:", error);
    } finally {
        await prisma.$disconnect();
    }
}

async function get_db(){
    const x = await prisma.userAuth.findMany();
    const y = await prisma.userState.findMany();
    const z = await prisma.token.findMany();


    console.log("x data", x);
    console.log("y data", y);
    console.log("z data", z);
}

get_db();