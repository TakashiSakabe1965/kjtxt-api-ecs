// ExpressとAWS SDKの初期化
const express = require('express');
const cors = require('cors');
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, ScanCommand, GetCommand } = require('@aws-sdk/lib-dynamodb');

// Expressアプリケーションの作成
const app = express();

// ポート番号を環境変数PORTから取得（未設定の場合は8080）
const port = process.env.PORT || 8080;

// CORS（クロスオリジン）対応
app.use(cors());

// DynamoDBクライアントの初期化（Secrets Managerから取得したREGIONを使用）
const region = process.env.REGION || 'ap-northeast-1';
const client = new DynamoDBClient({ region });
const dynamodb = DynamoDBDocumentClient.from(client);

// 使用するDynamoDBテーブル名（Secrets Managerから取得したDB_TABLE_NAMEを使用）
const tableName = process.env.DB_TABLE_NAME || 'kjtxt-translate-tb';

// ヘルスチェック用エンドポイント（ALBのヘルスチェックに使用）
app.get('/health', (req, res) => {
    res.status(200).send('OK');
});

// 全件取得API（DynamoDBから全レコードを取得し、skj→jkjの順で返す）
app.get('/kjtxts', async (req, res) => {
    try {
        const command = new ScanCommand({ TableName: tableName });
        const data = await dynamodb.send(command);

        if (!data.Items || data.Items.length === 0) {
            // レコードが存在しない場合は404を返す
            res.status(404).json("record not found");
        } else {
            // 必要な項目のみ抽出して返却
            const orderedItems = data.Items.map(item => ({
                skj: item.skj,
                jkj: item.jkj
            }));
            res.status(200).json(orderedItems);
        }
    } catch (err) {
        // エラー発生時は500を返す
        res.status(500).json({ error: err.message });
    }
});

// ID指定取得API（skjをクエリパラメータで受け取り、jkjのみ返す）
app.get('/kjtxt', async (req, res) => {
    const skj = req.query.skj;
    if (!skj) {
        // skjパラメータが不足している場合は400を返す
        return res.status(400).json({ error: "Missing 'skj' parameter" });
    }

    try {
        const command = new GetCommand({
            TableName: tableName,
            Key: { skj }
        });
        const data = await dynamodb.send(command);

        if (data.Item && data.Item.jkj !== undefined) {
            // 該当レコードが存在する場合はjkjを返す
            res.status(200).json({ jkj: data.Item.jkj });
        } else {
            // レコードが存在しない場合は404を返す
            res.status(404).json("record not found");
        }
    } catch (err) {
        // エラー発生時は500を返す
        res.status(500).json({ error: err.message });
    }
});

// サーバー起動 コンソールログ出力
app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
