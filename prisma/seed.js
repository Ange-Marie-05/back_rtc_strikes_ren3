const { PrismaClient} = require('@prisma/client'); // Import client Prisma
const prisma = new PrismaClient(); // Instance client Prisma
const bcrypt = require('bcryptjs'); // Import bcrypt pour hashage password

async function main() {
    // Nettoyage DB
    await prisma.react.deleteMany({});
    await prisma.directMessage.deleteMany({});
    await prisma.message.deleteMany({});
    await prisma.serverMember.deleteMany({});
    await prisma.channel.deleteMany({});
    await prisma.server.deleteMany({});
    await prisma.user.deleteMany({});

    // Hashage mot de passe
    const hashedPassword = await bcrypt.hash('AAaa##88', 14);

    // Users
    const user1 = await prisma.user.create({
        data: {
            username: 'Alice',
            email: 'tdev600ren3+alice@gmail.com',
            password: hashedPassword,
            twoFactorSecret: null
        }
    });
    console.log('User1 créé : ', user1.username);

    const user2 = await prisma.user.create({
        data: {
            username: 'Jiraya',
            email: 'tdev600ren3+jiraya@gmail.com',
            password: hashedPassword,
            twoFactorSecret: null
        }
    });
    console.log('User2 créé : ', user2.username);

    const user3 = await prisma.user.create({
        data: {
            username: 'Itachi',
            email: 'tdev600ren3+itachi@gmail.com',
            password: hashedPassword,
            twoFactorSecret: null
        }
    });
    console.log('User3 créé : ', user3.username);

    const user4 = await prisma.user.create({
        data: {
            username: 'Poutine',
            email: 'tdev600ren3+poutine@gmail.com',
            password: hashedPassword,
            twoFactorSecret: null
        }
    });
    console.log('User3 créé : ', user4.username);

    // Servers
    const server1 = await prisma.server.create({
        data: {
            name: 'Gaming Server',
            ownerId: user1.id
        }
    });
    console.log('Server1 créé : ', server1.name);

    const server2 = await prisma.server.create({
        data: {
            name: "Movie Server",
            ownerId: user2.id
        }
    });
    console.log('Server2 créé : ', server2.name);

    const server3 = await prisma.server.create({
        data: {
            name: 'Music Server',
            ownerId: user1.id
        }
    });
    console.log('Server3 créé : ', server3.name);

    const server4 = await prisma.server.create({
        data: {
            name: 'Book Server',
            ownerId: user1.id
        }
    });
    console.log('Server3 créé : ', server4.name);

    // ServerMember Owner
    const owner1 = await prisma.serverMember.create({
        data: {
            userId: user1.id,
            serverId: server1.id,
            role: "Owner",
            banned: false,
            banEndDate: null
        }
    });
    console.log('Owner1 créé : ', owner1.role);

    const owner2 = await prisma.serverMember.create({
        data: {
            userId : user2.id,
            serverId: server2.id,
            role: 'Owner',
            banned: false,
            banEndDate: null
        }
    });
    console.log('Owner2 créé : ', owner2.role);

    const owner3 = await prisma.serverMember.create({
        data: {
            userId : user3.id,
            serverId : server3.id,
            role: "Owner",
            banned: false,
            banEndDate : null
        }
    });
    console.log("Owner3 créé : ", owner3.role);

    const owner4 = await prisma.serverMember.create({
        data: {
            userId : user4.id,
            serverId : server4.id,
            role : "Owner",
            banned : false,
            banEndDate : null
        }
    });
    console.log("Owner4 créé : ", owner4.role);

    // Servers Members
    const member1 = await prisma.serverMember.create({
        data : {
            userId: user2.id,
            serverId: server1.id,
            role: "Member",
            banned: false,
            banEndDate: null
        }
    });
    console.log('Member1 créé : ', member1.role);

    const member2 = await prisma.serverMember.create({
        data : {
            userId: user1.id,
            serverId: server2.id,
            role: "Member",
            banned: false,
            banEndDate: null
        }
    });
    console.log('Member2 créé : ', member2.role);

    const member3 = await prisma.serverMember.create({
        data : {
            userId: user4.id,
            serverId: server3.id,
            role: "Member",
            banned: false,
            banEndDate: null
        }
    });
    console.log('Member3 créé : ', member3.role);

    const member4 = await prisma.serverMember.create({
        data : {
            userId: user3.id,
            serverId: server4.id,
            role: "Member",
            banned: false,
            banEndDate: null
        }
    });
    console.log('Member4 créé : ', member4.role);

    const member5 = await prisma.serverMember.create({
        data : {
            userId: user1.id,
            serverId: server3.id,
            role: "Member",
            banned: false,
            banEndDate: null
        }
    });
    console.log('Member5 créé : ', member5.role);

    const member6 = await prisma.serverMember.create({
        data : {
            userId: user2.id,
            serverId: server4.id,
            role: "Member",
            banned: false,
            banEndDate: null
        }
    });
    console.log('Member6 créé : ', member6.role);

    // Channels
    const channel1 = await prisma.channel.create({
        data: {
            serverId: server1.id,
            name: "LoL c'est pour les puants"
        }
    })
    console.log('Channel1 créé : ', channel1.name);

    const channel2 = await prisma.channel.create({
        data: {
            serverId: server2.id,
            name: "Fight Club dans mon sang"
        }
    })
    console.log('Channel2 créé : ', channel2.name);

    const channel3 = await prisma.channel.create({
        data: {
            serverId: server3.id,
            name: "Sauve une teuf mange un trance"
        }
    })
    console.log('Channel3 créé : ', channel3.name);

    const channel4 = await prisma.channel.create({
        data: {
            serverId: server4.id,
            name: "Harry Potter c'est nul en fait"
        }
    })
    console.log('Channel4 créé : ', channel4.name);

    // Messages
    const message1 = await prisma.message.create({
        data: {
            userId: user1.id,
            channelId: channel1.id,
            content: "HI"
        }
    });
    console.log('Message1 créé : ', message1.content);

    const message2 = await prisma.message.create({
        data: {
            userId: user2.id,
            channelId: channel1.id,
            content: "Yahh"
        }
    });
    console.log('Message2 créé : ', message2.content);

    const message3 = await prisma.message.create({
        data: {
            userId: user1.id,
            channelId: channel2.id,
            content: "Meeee"
        }
    });
    console.log('Message3 créé : ', message3.content);

    const message4 = await prisma.message.create({
        data: {
            userId: user2.id,
            channelId: channel2.id,
            content: "IIiiii"
        }
    });
    console.log('Message4 créé : ', message4.content);

    const message5 = await prisma.message.create({
        data: {
            userId: user3.id,
            channelId: channel4.id,
            content: "IIiiii"
        }
    });
    console.log('Message5 créé : ', message5.content);

    const message6 = await prisma.message.create({
        data: {
            userId: user4.id,
            channelId: channel4.id,
            content: "IIiiii"
        }
    });
    console.log('Message6 créé : ', message6.content);

    const message7 = await prisma.message.create({
        data: {
            userId: user2.id,
            channelId: channel4.id,
            content: "IIiiii"
        }
    });
    console.log('Message7 créé : ', message7.content);

    const message8 = await prisma.message.create({
        data: {
            userId: user4.id,
            channelId: channel3.id,
            content: "IIiiii"
        }
    });
    console.log('Message8 créé : ', message8.content);

    const message9 = await prisma.message.create({
        data: {
            userId: user1.id,
            channelId: channel3.id,
            content: "IIiiii"
        }
    });
    console.log('Message9 créé : ', message9.content);

    const message10 = await prisma.message.create({
        data: {
            userId: user4.id,
            channelId: channel3.id,
            content: "IIiiii"
        }
    });
    console.log('Message10 créé : ', message10.content);
}

// Exécution avec gestion d'erreur
main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });