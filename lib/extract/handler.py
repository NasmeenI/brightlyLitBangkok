import json
import boto3
import asyncio
import os
import uuid
from aimet_feature_extraction import getMultipleChatCompletionMessage


async def run_gpt(input):
    result = await getMultipleChatCompletionMessage(input)
    return result


# event
# message : [ {question : str , answer : str} ]
# group_flag : 

def handler(event: any, context: any):

    dynamodb = boto3.resource("dynamodb")

    prompt_table_name = os.getenv("PROMPT_TABLE_NAME")
    prompt_table = dynamodb.Table(prompt_table_name)

    prompt = prompt_table.get_item(Key={"PK": "1"})
    role_system = bytes(prompt["Item"]["system"], "utf-8").decode("utf-8")
    role_user = bytes(prompt["Item"]["user"], "utf-8").decode("utf-8")
    role_assistant = bytes(prompt["Item"]["assistant"], "utf-8").decode("utf-8")

    inputs = [
        {
            "messages": [
                {"role": "system", "content": role_system},
                {"role": "user", "content": role_user},
                {"role": "assistant", "content": role_assistant}
            ] + [
                {
                    "role": "user",
                    "content": f"<MessageGroup>\n<Question>{bytes(message["question"], "utf-8").decode("utf-8") if ("question" in message) else "Tell us anything about yourself"}</Question>\n<Answer>"
                    + bytes(message["answer"], "utf-8").decode("utf-8")
                    + "</Answer>\n</MessageGroup>\n\n<FeatureFlagList>\nis_venting, is_inquiry, is_give_support, is_seek_understanding, is_family, is_work, is_study, is_financial, is_interpersonal, is_personal, is_Social_cultural, is_depressed, is_bipolar, is_sleep_problem, is_suicide, is_self-harm, is_burn-out, is_stress, is_panic, is_ocd, is_anxiety, is_inquire_medication_effect, is_self-discontinued_drug, is_accessing_psychiatric_treatment, is_medicine_price, is_insurance\n</FeatureFlagList>",
                } for message in event["message"]
            ] 
        } 
    ]
    
    loop = asyncio.new_event_loop()
    result = loop.run_until_complete(run_gpt(inputs))
    
    postId = str(uuid.uuid4())
    record_table_name = os.getenv("RECORD_TABLE_NAME")
    record_table = dynamodb.Table(record_table_name)
    
    record = dict()
    record["PK"] = postId
    record["request"] = event
    record["response"] = result
    record["prompt"] = inputs[0]
    
    record_table.put_item(Item=record)
    
    return {
        "statusCode": 200, 
        "body": result
    }