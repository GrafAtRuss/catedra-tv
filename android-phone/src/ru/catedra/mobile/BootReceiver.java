package ru.catedra.mobile;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

public class BootReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        HomeChannel.ensureLive(context.getApplicationContext());
    }
}
